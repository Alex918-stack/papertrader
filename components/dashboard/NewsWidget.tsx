"use client";

import { useState } from "react";
import { useNews, NewsArticle } from "@/hooks/useNews";
import NewsCard from "@/components/news/NewsCard";
import NewsModal from "@/components/news/NewsModal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function NewsWidget() {
  const general = useNews(undefined, "general");
  const crypto = useNews(undefined, "crypto");
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(
    null
  );

  const loading = general.loading || crypto.loading;
  const generalError = general.error ? `General news unavailable: ${general.error}` : null;
  const cryptoError = crypto.error ? `Crypto news unavailable: ${crypto.error}` : null;
  const hasPartialErrors = Boolean(general.error || crypto.error);

  // Interleave a few from each so it's not all one category
  const mixed = [
    ...general.articles.slice(0, 3),
    ...crypto.articles.slice(0, 2),
  ].sort((a, b) => b.datetime - a.datetime);

  const hasArticles = mixed.length > 0;
  const showPartialError = hasPartialErrors && hasArticles;
  const showFullError = hasPartialErrors && !hasArticles;

  return (
    <div id="tour-news-widget" className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        Top Stories
      </h2>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      )}

      {showPartialError && (
        <div className="mb-3 space-y-1 text-xs text-amber-700">
          {generalError && <p>{generalError}</p>}
          {cryptoError && <p>{cryptoError}</p>}
        </div>
      )}

      {showFullError && (
        <p className="text-sm text-red-600">
          {generalError && cryptoError
            ? `Couldn't load news: ${general.error} / ${crypto.error}`
            : `Couldn't load news: ${generalError ?? cryptoError}`}
        </p>
      )}

      {!loading && !showFullError && mixed.length === 0 && (
        <p className="text-sm text-neutral-400">No news available.</p>
      )}

      {!loading && mixed.length > 0 && (
        <div>
          {mixed.slice(0, 5).map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              onSelect={setSelectedArticle}
            />
          ))}
        </div>
      )}

      <NewsModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}