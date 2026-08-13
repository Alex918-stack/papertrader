"use client";

import { useState } from "react";
import { useNews, NewsArticle } from "@/hooks/useNews";
import NewsCard from "@/components/news/NewsCard";
import NewsModal from "@/components/news/NewsModal";
import CategoryTabs from "@/components/news/CategoryTabs";

const MAX_ARTICLES = 12;

export default function NewsPage() {
  const [category, setCategory] = useState("general");
  const { articles, loading, error } = useNews(undefined, category);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(
    null
  );

  const visible = articles.slice(0, MAX_ARTICLES);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">News stories</h1>
        <p className="text-sm text-neutral-500 mt-1">
          From market data providers and news partners
        </p>
      </div>

      <CategoryTabs active={category} onChange={setCategory} />

      {loading && <p className="text-sm text-neutral-500">Loading news...</p>}
      {error && (
        <p className="text-sm text-red-400">Couldn't load news: {error}</p>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="text-sm text-neutral-500">
          No articles found for this category.
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {visible.map((article) => (
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