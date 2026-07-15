import { NextRequest, NextResponse } from "next/server";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const type = request.nextUrl.searchParams.get("type") ?? "quote";

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY" },
      { status: 500 }
    );
  }

  try {
    if (type === "candles") {
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

      const response = await fetch(
        `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${thirtyDaysAgo}&to=${now}&token=${apiKey}`
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            error: `Finnhub candle request failed with status ${response.status}. This endpoint may require a paid plan.`,
          },
          { status: response.status }
        );
      }

      const data = await response.json();

      if (data.s !== "ok") {
        return NextResponse.json(
          {
            error:
              "No candle data available for this symbol (may require a premium plan).",
          },
          { status: 404 }
        );
      }

      const points = data.t.map((timestamp: number, i: number) => ({
        date: new Date(timestamp * 1000).toISOString().split("T")[0],
        close: data.c[i],
      }));

      return NextResponse.json({ symbol, points });
    }

    // default: current quote
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}