"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, BarChart3, ChevronRight } from "lucide-react";
import { useJournal } from "@/components/journal/JournalProvider";
import JournalEpisodeCard from "@/components/journal/JournalEpisodeCard";
import PageHeroHeader from "@/components/layout/PageHeroHeader";
import GuestNotice from "@/components/ui/GuestNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

// Wrapped in Suspense below because it calls useSearchParams - per Next's
// own docs (checked in node_modules/next/dist/docs before writing this,
// not assumed from training data, since this project's Next.js version can
// differ from what's expected), a static page that calls useSearchParams
// without a Suspense boundary fails at production build time, not just in
// dev.
function JournalContent() {
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get("episode");
  const journal = useJournal();

  const episodesLoaded = journal.status === "ok";
  useEffect(() => {
    if (!highlightedId || !episodesLoaded) return;
    document.getElementById(`episode-${highlightedId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedId, episodesLoaded]);

  if (journal.status === "loading") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (journal.status === "signed_out") {
    return (
      <Card>
        <GuestNotice />
      </Card>
    );
  }

  const openEpisodes = journal.episodes.filter((e) => e.closedAt === null);
  const closedEpisodes = journal.episodes.filter((e) => e.closedAt !== null);

  return (
    <div className="space-y-4">
      {journal.totalCount > 0 && (
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-coral-50 text-coral-600 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} />
          </div>
          <p className="text-sm text-neutral-700">
            You wrote a thesis for{" "}
            <span className="font-semibold text-neutral-900">
              {journal.thesisCount} of {journal.totalCount}
            </span>{" "}
            position{journal.totalCount === 1 ? "" : "s"}.
          </p>
        </Card>
      )}

      {journal.totalCount > 0 && (
        <Link href="/journal/scorecard">
          <Card interactive className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-seafoam-50 text-seafoam-700 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-900">Decision Quality Scorecard</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Were you skilled or lucky - not just whether you made money.
              </p>
            </div>
            <ChevronRight size={16} className="text-neutral-400 flex-shrink-0" />
          </Card>
        </Link>
      )}

      {journal.episodes.length === 0 ? (
        <Card padding="detail" className="text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-coral-50 text-coral-600 flex items-center justify-center mx-auto">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Winning and being right aren&apos;t the same thing.
            </h2>
            <p className="text-sm text-neutral-600 mt-1 max-w-md mx-auto">
              Write down why you&apos;re opening a position and what would
              prove you wrong. When you close it, Krix tells you honestly
              whether your reasoning held up - that&apos;s the part your P&L
              can&apos;t tell you.
            </p>
          </div>
          <Link href="/trading" className={buttonVariants()}>
            Open Your First Position
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Open first (more actionable, still current), closed after -
              same small-label grouping TopMovers already uses for Top
              Gainers/Top Losers, not a new UI pattern. Only rendered when
              that group actually has something in it. */}
          {openEpisodes.length > 0 && (
            <div>
              <p className="text-xs text-neutral-400 mb-2">Open</p>
              <div className="space-y-3">
                {openEpisodes.map((episode) => (
                  <JournalEpisodeCard
                    key={episode.id}
                    episode={episode}
                    highlighted={episode.id === highlightedId}
                    onUpdate={journal.updateEpisode}
                  />
                ))}
              </div>
            </div>
          )}
          {closedEpisodes.length > 0 && (
            <div>
              <p className="text-xs text-neutral-400 mb-2">Closed</p>
              <div className="space-y-3">
                {closedEpisodes.map((episode) => (
                  <JournalEpisodeCard
                    key={episode.id}
                    episode={episode}
                    highlighted={episode.id === highlightedId}
                    onUpdate={journal.updateEpisode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JournalPage() {
  return (
    <div className="space-y-6">
      <PageHeroHeader
        icon={BookOpen}
        title="Journal"
        subtitle="Every position you've opened, what you told yourself going in, and what actually happened."
      />
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <JournalContent />
      </Suspense>
    </div>
  );
}
