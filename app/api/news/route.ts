import { NextRequest, NextResponse } from "next/server";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const category = request.nextUrl.searchParams.get("category") ?? "general";

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
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const toDate = today.toISOString().split("T")[0];
      const fromDate = weekAgo.toISOString().split("T")[0];

      url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    } else {
      url = `${FINNHUB_BASE_URL}/news?category=${category}&token=${apiKey}`;
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

const TRUSTED_SOURCES = [
      "Reuters",
      "CNBC",
      "MarketWatch",
      "Barron's",
      "Yahoo",
      "Forbes",
      "Business Insider",
      "The Wall Street Journal",
      "Financial Times",
      "Investor's Business Daily",
    ];

    const isTrusted = (source: string) =>
      TRUSTED_SOURCES.some((trusted) =>
        source.toLowerCase().includes(trusted.toLowerCase())
      );

    const articles = (data as FinnhubNewsItem[])
      .filter((item) => isTrusted(item.source))
      .slice(0, 15)
      .map((item) => ({
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