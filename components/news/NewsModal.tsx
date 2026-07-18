"use client";

import { NewsArticle } from "@/hooks/useNews";

interface NewsModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export default function NewsModal({ article, onClose }: NewsModalProps) {
  if (!article) return null;

  const date = new Date(article.datetime * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {article.image && (
          <img
            src={article.image}
            alt=""
            className="w-full h-48 object-cover rounded-t-lg bg-neutral-800"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <h2 className="text-xl font-bold text-neutral-100">
              {article.headline}
            </h2>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-200 text-2xl leading-none flex-shrink-0"
              aria-label="Close"
            >
              x
            </button>
          </div>

          <p className="text-xs text-neutral-500">
            {article.source} - {date}
          </p>

          <p className="text-sm text-neutral-300 leading-relaxed">
            {article.summary}
          </p>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-md transition-colors"
          >
            Read full article
          </a>
        </div>
      </div>
    </div>
  );
}