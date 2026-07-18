import { NewsArticle } from "@/hooks/useNews";

interface NewsCardProps {
  article: NewsArticle;
  onSelect: (article: NewsArticle) => void;
}

export default function NewsCard({ article, onSelect }: NewsCardProps) {
  const date = new Date(article.datetime * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={() => onSelect(article)}
      className="flex gap-3 bg-neutral-900 border border-neutral-800 rounded-lg p-3 hover:border-neutral-700 transition-colors text-left w-full"
    >
      {article.image && (
        <img
          src={article.image}
          alt=""
          className="w-20 h-20 object-cover rounded-md flex-shrink-0 bg-neutral-800"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-100 line-clamp-2">
          {article.headline}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          {article.source} - {date}
        </p>
      </div>
    </button>
  );
}