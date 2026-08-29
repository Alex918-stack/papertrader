"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useStockQuotes } from "@/hooks/useStockQuotes";
import { useNews, NewsArticle } from "@/hooks/useNews";
import { ALL_ASSETS } from "@/lib/stockSymbols";
import StockChart from "@/components/charts/StockChart";
import NewsModal from "@/components/news/NewsModal";
import { relativeTime } from "@/lib/relativeTime";
import { colorForSource } from "@/lib/sourceColors";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { formatMoney } from "@/lib/format";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

interface StockDetailProps {
  symbol: string;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const { quotes, loading, error } = useStockQuotes([symbol]);
  const quote = quotes[symbol];
  const stockInfo = ALL_ASSETS.find((s) => s.symbol === symbol);
  const animatedPrice = useAnimatedNumber(quote?.price ?? 0);

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
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft size={14} />
        Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{symbol}</h1>
        {stockInfo && <p className="text-neutral-500">{stockInfo.name}</p>}
      </div>

      {loading && (
        <p className="text-sm text-neutral-400">Loading quote...</p>
      )}

      {error && (
        <p className="text-sm text-red-600">
          Couldn&apos;t load data for {symbol}: {error}
        </p>
      )}

      {!loading && !error && quote && (
        <Card id="tour-stock-detail" padding="detail" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-400">Current Price</p>
              <p className="num text-4xl font-bold text-neutral-900">
                ${formatMoney(animatedPrice)}
              </p>
              <p
                className={`num text-sm font-medium mt-1 ${
                  quote.change >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {quote.change >= 0 ? "+" : ""}
                {formatMoney(quote.change)} ({quote.change >= 0 ? "+" : ""}
                {quote.changePercent.toFixed(2)}%) today
              </p>
            </div>

            {stockInfo?.description && (
              <p className="text-sm text-neutral-500 sm:max-w-xs sm:text-right leading-relaxed">
                {stockInfo.description}
              </p>
            )}
          </div>

          <Link href="/trading" className={buttonVariants({ className: "inline-flex" })}>
            Trade {symbol}
          </Link>

          {!newsLoading && !newsError && articles.length > 0 && (
            <button
              onClick={() => setSelectedArticle(articles[0])}
              className="block w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md p-3 transition-colors"
            >
              <p className="font-serif text-sm text-neutral-900 line-clamp-2 mb-1.5">
                {articles[0].headline}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-coral-800 uppercase tracking-wide bg-coral-50 px-1.5 py-0.5 rounded flex-shrink-0">
                  News
                </span>
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    colorForSource(articles[0].source).bg
                  } ${colorForSource(articles[0].source).text}`}
                >
                  {articles[0].source.charAt(0)}
                </div>
                <span className="text-xs text-neutral-500">
                  {articles[0].source}
                </span>
                <span className="text-xs text-neutral-300">·</span>
                <span className="text-xs text-neutral-400">
                  {relativeTime(articles[0].datetime)}
                </span>
              </div>
            </button>
          )}
        </Card>
      )}

      <StockChart symbol={symbol} />

      <NewsModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}