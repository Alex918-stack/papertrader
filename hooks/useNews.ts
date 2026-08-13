"use client";

import { useState, useEffect } from "react";

export interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image: string;
}

export function useNews(symbol?: string, category?: string) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNews() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (symbol) params.set("symbol", symbol);
        if (category) params.set("category", category);

        const res = await fetch(`/api/news?${params.toString()}`);
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setArticles(data.articles ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load news");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNews();

    return () => {
      cancelled = true;
    };
  }, [symbol, category]);

  return { articles, loading, error };
}