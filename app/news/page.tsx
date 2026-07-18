"use client";

import { useState } from "react";
import { useNews, NewsArticle } from "@/hooks/useNews";
import NewsCard from "@/components/news/NewsCard";
import NewsModal from "@/components/news/NewsModal";

export default function NewsPage() {
  const { articles, loading, error } = useNews();
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(
    null
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Market News</h1>

      {loading && <p className="text-sm text-neutral-500">Loading news...</p>}
      {error && (
        <p className="text-sm text-red-400">Couldn't load news: {error}</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {articles.map((article) => (
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