"use client";

import { useState } from "react";
import Link from "next/link";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useNews, NewsArticle } from "@/hooks/useNews";
import { WATCHED_STOCKS } from "@/lib/stockSymbols";
import StockChart from "@/components/charts/StockChart";
import NewsModal from "@/components/news/NewsModal";
import { relativeTime } from "@/lib/relativeTime";
import { colorForSource } from "@/lib/sourceColors";

interface StockDetailProps {
  symbol: string;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const { quotes, loading, error } = useStockQuotes([symbol]);
  const quote = quotes[symbol];
  const stockInfo = WATCHED_STOCKS.find((s) => s.symbol === symbol);

  const {
    articles,
    loading: newsLoading,
    error: newsError,
  } = useNews(symbol);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(
    null
  );

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-sm text-neutral-400 hover:text-neutral-200"
      >
        ← Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{symbol}</h1>
        {stockInfo && <p className="text-neutral-400">{stockInfo.name}</p>}
      </div>

      {loading && (
        <p className="text-sm text-neutral-500">Loading quote...</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Couldn't load data for {symbol}: {error}
        </p>
      )}

      {!loading && !error && quote && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500">Current Price</p>
              <p className="text-4xl font-bold text-neutral-100">
                ${quote.price.toFixed(2)}
              </p>
              <p
                className={`text-sm font-medium mt-1 ${
                  quote.change >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {quote.change >= 0 ? "+" : ""}
                {quote.change.toFixed(2)} ({quote.change >= 0 ? "+" : ""}
                {quote.changePercent.toFixed(2)}%) today
              </p>
            </div>

            {stockInfo?.description && (
              <p className="text-sm text-neutral-400 sm:max-w-xs sm:text-right leading-relaxed">
                {stockInfo.description}
              </p>
            )}
          </div>

          <Link
            href="/trading"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-md transition-colors"
          >
            Trade {symbol}
          </Link>

          {!newsLoading && !newsError && articles.length > 0 && (
            <button
              onClick={() => setSelectedArticle(articles[0])}
              className="block w-full text-left bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md p-3 transition-colors"
            >
              <p className="text-xs text-emerald-400 font-medium uppercase tracking-wide mb-1.5">
                Latest News
              </p>
              <p className="text-sm text-neutral-100 line-clamp-2 mb-1.5">
                {articles[0].headline}
              </p>
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                    colorForSource(articles[0].source).bg
                  } ${colorForSource(articles[0].source).text}`}
                >
                  {articles[0].source.charAt(0)}
                </div>
                <span className="text-xs text-neutral-500">
                  {articles[0].source}
                </span>
                <span className="text-xs text-neutral-600">·</span>
                <span className="text-xs text-neutral-600">
                  {relativeTime(articles[0].datetime)}
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      <StockChart symbol={symbol} />

      <NewsModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}