import { NextRequest, NextResponse } from "next/server";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing FINNHUB_API_KEY" },
      { status: 500 }
    );
  }

  try {
    let url: string;

    if (symbol) {
      // News for a specific company, last 7 days
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const toDate = today.toISOString().split("T")[0];
      const fromDate = weekAgo.toISOString().split("T")[0];

      url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    } else {
      // General market news
      url = `${FINNHUB_BASE_URL}/news?category=general&token=${apiKey}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub news request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    interface FinnhubNewsItem {
      id: number;
      headline: string;
      summary: string;
      source: string;
      url: string;
      datetime: number;
      image: string;
    }

    const articles = (data as FinnhubNewsItem[]).slice(0, 15).map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: item.datetime,
      image: item.image,
    }));

    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}