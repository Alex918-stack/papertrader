import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

async function getStockQuote(symbol: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const res = await fetch(
    `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`
  );
  const data = await res.json();
  return {
    symbol,
    price: data.c,
    change: data.d,
    changePercent: data.dp,
    dayHigh: data.h,
    dayLow: data.l,
    dayOpen: data.o,
  };
}

async function getStockNews(symbol: string) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const toDate = today.toISOString().split("T")[0];
  const fromDate = weekAgo.toISOString().split("T")[0];

  const res = await fetch(
    `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`
  );
  const data = await res.json();
  return (data as any[]).slice(0, 5).map((item) => ({
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    date: new Date(item.datetime * 1000).toISOString().split("T")[0],
  }));
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_stock_quote",
      description:
        "Get the current live price, today's change, and day range for a stock symbol.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol, e.g. AAPL, NVDA, TSLA",
          },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_news",
      description:
        "Get recent news headlines and summaries for a specific company, from the last 7 days.",
      parameters: {
        type: "object",
        properties: {
          symbol: {
            type: "string",
            description: "The stock ticker symbol, e.g. AAPL, NVDA, TSLA",
          },
        },
        required: ["symbol"],
      },
    },
  },
];

async function callModel(messages: ChatMessage[], token: string) {
  const response = await fetch(
    "https://models.github.ai/inference/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages,
        tools: TOOLS,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub Models request failed: ${errText}`);
  }

  return response.json();
}

const lastRequestTime = new Map<string, number>();
const COOLDOWN_MS = 2000;

export async function POST(request: NextRequest) {
  const session = await (await import("@/auth")).auth();
  const userId = session?.user?.email ?? "anonymous";
  const now = Date.now();
  const last = lastRequestTime.get(userId) ?? 0;

  if (now - last < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another message." },
      { status: 429 }
    );
  }
  lastRequestTime.set(userId, now);

  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Server is missing GITHUB_MODELS_TOKEN" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const incomingMessages: ChatMessage[] = body.messages;
  const portfolioContext: string = body.portfolioContext ?? "";

  const systemMessage: ChatMessage = {
    role: "assistant",
    content: `You are a helpful financial research assistant inside a paper trading app called AI Paper Trader. The user is practicing investing with fake money. You have access to tools to look up live stock prices and recent news - use them whenever the user asks about a specific stock's current price, performance, or news, rather than guessing or using outdated information. Be concise and clear. You are not a licensed financial advisor and should not give personalized investment advice as fact - frame things as educational information, not recommendations to buy or sell. Here is the user's current portfolio data:\n\n${portfolioContext}`,
  };

  let messages: ChatMessage[] = [
    { role: "assistant" as any, content: systemMessage.content },
    ...incomingMessages,
  ];
  // Correct the system message role (GitHub Models expects "system", fixing after TS union above)
  messages[0] = { role: "system" as any, content: systemMessage.content };

  try {
    let data = await callModel(messages, token);
    let choice = data.choices?.[0];

    // Handle up to 3 rounds of tool calls, in case the AI needs multiple lookups
    let rounds = 0;
    while (choice?.message?.tool_calls && rounds < 3) {
      const toolCalls = choice.message.tool_calls;

      messages.push({
        role: "assistant",
        content: choice.message.content ?? "",
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result;

        if (fnName === "get_stock_quote") {
          result = await getStockQuote(args.symbol);
        } else if (fnName === "get_stock_news") {
          result = await getStockNews(args.symbol);
        } else {
          result = { error: "Unknown tool" };
        }

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      }

      data = await callModel(messages, token);
      choice = data.choices?.[0];
      rounds++;
    }

    const reply = choice?.message?.content ?? "No response generated.";
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach GitHub Models API" },
      { status: 500 }
    );
  }
}