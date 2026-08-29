import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared chrome for /privacy and /terms. Deliberately plain: these are
 * documents people read, not surfaces to decorate. No video, no rain, no
 * scroll reveals - legal text that fades in as you scroll is hostile.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-coral-600 transition-colors mb-10"
        >
          <ArrowLeft size={15} />
          Back to AI Paper Trader
        </Link>

        <h1 className="text-3xl font-semibold text-neutral-900 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-neutral-400 mt-2 mb-10">
          Last updated: {updated}
        </p>

        <div className="legal-prose space-y-6 text-[15px] leading-relaxed text-neutral-600">
          {children}
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-200 flex gap-6 text-sm text-neutral-500">
          <Link href="/privacy" className="hover:text-coral-600 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-coral-600 transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
