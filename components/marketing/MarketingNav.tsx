"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useMotionTemplate } from "motion/react";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Waves } from "lucide-react";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

export default function MarketingNav() {
  const { status } = useAuth();
  // Was position:absolute, scoped to the hero section - meant the nav
  // scrolled away entirely past the first viewport, with nothing to
  // replace it. Fixed instead, so it persists for the whole page; the
  // glass treatment below is what makes that persistence read as
  // intentional (a real bar) rather than a stray floating header once the
  // video is no longer behind it. Backdrop-blur here sits over whatever's
  // scrolling underneath (the video early, page content after) - always
  // real, moving content, never a flat fill.
  //
  // Floor, not zero, at rest: the hero's own scrim only lightens its LEFT
  // side (where the headline sits) - "Sign in" and the plain nav links on
  // the RIGHT can sit directly over the darkest, least-scrimmed part of
  // the graded footage. A hard 0% start meant dark nav text over dark
  // video there. 0.22 keeps a faint wash under the text everywhere,
  // regardless of horizontal position, strengthening to full glass on
  // scroll same as before.
  const { scrollY } = useScroll();
  const glassOpacity = useTransform(scrollY, [0, 80], [0.22, 1]);
  const blurPx = useTransform(scrollY, [0, 80], [6, 16]);
  const backdropFilter = useMotionTemplate`blur(${blurPx}px)`;

  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-20">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 border-b border-white/40"
        style={{ backgroundColor: "rgba(255,255,255,0.65)", opacity: glassOpacity, backdropFilter, WebkitBackdropFilter: backdropFilter }}
      />
      <div className="relative max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-coral-500 text-white">
            <Waves size={16} />
          </span>
          AI Paper Trader
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-700">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-neutral-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {status !== "authenticated" && (
            <button
              onClick={handleSignIn}
              className="hidden sm:inline text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              Sign in
            </button>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full bg-coral-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-coral-600 active:scale-[0.97] transition-all"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
