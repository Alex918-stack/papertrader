"use client";

import { useState } from "react";
import { useNews, NewsArticle } from "@/hooks/useNews";
import NewsCard from "@/components/news/NewsCard";
import NewsModal from "@/components/news/NewsModal";

export default function NewsWidget() {
  const general = useNews(undefined, "general");
  const crypto = useNews(undefined, "crypto");
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(
    null
  );

  const loading = general.loading || crypto.loading;
  const error = general.error || crypto.error;

  // Interleave a few from each so it's not all one category
  const mixed = [
    ...general.articles.slice(0, 3),
    ...crypto.articles.slice(0, 2),
  ].sort((a, b) => b.datetime - a.datetime);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        Top Stories
      </h2>

      {loading && <p className="text-sm text-neutral-500">Loading news...</p>}
      {error && (
        <p className="text-sm text-red-400">Couldn't load news: {error}</p>
      )}

      {!loading && !error && mixed.length === 0 && (
        <p className="text-sm text-neutral-500">No news available.</p>
      )}

      {!loading && !error && mixed.length > 0 && (
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