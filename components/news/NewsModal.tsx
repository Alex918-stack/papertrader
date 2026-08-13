"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { NewsArticle } from "@/hooks/useNews";

interface NewsModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export default function NewsModal({ article, onClose }: NewsModalProps) {
  const [imageOk, setImageOk] = useState(true);

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
        className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto thin-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full aspect-video bg-neutral-800 overflow-hidden">
          {article.image && imageOk ? (
            <img
              src={article.image}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageOk(false)}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.naturalWidth < 300 || img.naturalHeight < 180) {
                  setImageOk(false);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Newspaper size={32} className="text-neutral-700" />
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
<span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
                {article.source}
              </span>
              <span>{date}</span>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-200 text-xl leading-none flex-shrink-0"
              aria-label="Close"
            >
              x
            </button>
          </div>

          <h2 className="text-xl font-bold text-neutral-100 leading-snug">
            {article.headline}
          </h2>

          <p className="text-base text-neutral-300 leading-relaxed">
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