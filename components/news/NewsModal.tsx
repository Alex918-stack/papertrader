"use client";

import { useState } from "react";
import { Newspaper, X } from "lucide-react";
import { NewsArticle } from "@/hooks/useNews";
import { useDelayedUnmount } from "@/hooks/useDelayedUnmount";

interface NewsModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export default function NewsModal({ article, onClose }: NewsModalProps) {
  const [imageOk, setImageOk] = useState(true);
  const { shouldRender, state } = useDelayedUnmount(article !== null, 150);

  // article goes null the instant onClose fires - that IS the close signal,
  // not a separate event - so keep the last non-null value around for the
  // exit animation to fade out instead of unmounting with nothing to show.
  const [lastArticle, setLastArticle] = useState(article);
  if (article !== null && article !== lastArticle) {
    setLastArticle(article);
  }

  if (!shouldRender) return null;
  const shown = article ?? lastArticle;
  if (!shown) return null;

  const date = new Date(shown.datetime * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="overlay-enter fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      data-state={state}
      onClick={onClose}
    >
      <div
        className="modal-enter bg-white border border-neutral-200 rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto thin-scrollbar shadow-xl"
        data-state={state}
        data-lenis-prevent
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full aspect-video bg-neutral-100 overflow-hidden">
          {shown.image && imageOk ? (
            // next/image needs every external host allowlisted in
            // next.config.ts's remotePatterns - article images come from
            // whatever publisher the news API returns, an unbounded set of
            // hosts, not one fixed domain like the avatar images
            // elsewhere. Widening remotePatterns to a wildcard host so this
            // could use <Image> would let Next proxy/optimize requests to
            // arbitrary external URLs, a real tradeoff, not a lint fix -
            // staying on a plain <img> here deliberately.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.image}
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
              <Newspaper size={32} className="text-neutral-300" />
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
<span className="bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                {shown.source}
              </span>
              <span>{date}</span>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 active:scale-[0.9] transition-transform duration-150 ease-out-quart flex-shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <h2 className="font-serif text-xl font-bold text-neutral-900 leading-snug">
            {shown.headline}
          </h2>

          <p className="font-serif text-base text-neutral-600 leading-relaxed">
            {shown.summary}
          </p>

          <a
            href={shown.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-coral-500 hover:bg-coral-600 active:scale-[0.97] text-white font-medium px-4 py-2 rounded-md transition-all duration-150 ease-out-quart"
          >
            Read full article
          </a>
        </div>
      </div>
    </div>
  );
}