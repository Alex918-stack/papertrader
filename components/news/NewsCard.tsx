"use client";

import { NewsArticle } from "@/hooks/useNews";
import { relativeTime } from "@/lib/relativeTime";
import { colorForSource } from "@/lib/sourceColors";

interface NewsCardProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
}

export default function NewsCard({ article, onSelect }: NewsCardProps) {
  const color = colorForSource(article.source);

  return (
    <button
      onClick={() => onSelect(article)}
      className="text-left w-full py-3 border-b border-neutral-100 last:border-0"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color.bg} ${color.text}`}
        >
          {article.source.charAt(0)}
        </div>
        <span className="text-xs text-neutral-500">{article.source}</span>
        <span className="text-xs text-neutral-300">·</span>
        <span className="text-xs text-neutral-400">
          {relativeTime(article.datetime)}
        </span>
      </div>
      <p className="font-serif text-sm font-medium text-neutral-900 leading-snug line-clamp-2">
        {article.headline}
      </p>
    </button>
  );
}