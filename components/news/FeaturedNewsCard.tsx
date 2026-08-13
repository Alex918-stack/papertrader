import { Newspaper } from "lucide-react";
import { NewsArticle } from "@/hooks/useNews";
import { useState } from "react";

interface FeaturedNewsCardProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
}

export default function FeaturedNewsCard({
  article,
  onSelect,
}: FeaturedNewsCardProps) {
  const [imageOk, setImageOk] = useState(true);

  const date = new Date(article.datetime * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <button
      onClick={() => onSelect(article)}
      className="text-left bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-700 transition-colors flex flex-col sm:flex-row w-full"
    >
<div className="relative w-full sm:w-2/5 aspect-video sm:aspect-auto bg-neutral-800 overflow-hidden flex-shrink-0">
        {article.image && imageOk ? (
          <>
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
            <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-neutral-900 via-neutral-900/10 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Newspaper size={32} className="text-neutral-700" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 justify-center">
        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
          Top Story
        </span>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-100 leading-snug">
          {article.headline}
        </h2>
        <p className="text-sm text-neutral-400 line-clamp-2">
          {article.summary}
        </p>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
            {article.source}
          </span>
          <span>{date}</span>
        </div>
      </div>
    </button>
  );
}