"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Wallet } from "lucide-react";
import AtmosphereVideo from "./AtmosphereVideo";
import Rain from "./Rain";
import MarketingNav from "./MarketingNav";
import TiltCard from "@/components/ui/TiltCard";
import Card from "@/components/ui/Card";
import PricingBreakdown from "@/components/trading/PricingBreakdown";

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[#0a1218]">
      <AtmosphereVideo />
      {/* sand-100 wash, strong on the left where the headline sits (dark
          text needs a light reading zone regardless of what's behind it),
          fading out by the right edge so the graded footage - the whole
          point of it - reads at full strength where the glass card floats.
          The video itself is dark; this only needs to lighten, never
          needs its own dark tint layered on top of it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(250,244,232,0.95) 0%, rgba(250,244,232,0.72) 34%, rgba(250,244,232,0.22) 62%, rgba(250,244,232,0.04) 100%)",
        }}
      />
      <Rain />
      <MarketingNav />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16 min-h-[100dvh] flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-neutral-900 leading-[1.05]">
              Trade real markets.
              <br />
              Zero real risk.
            </h1>
            <p className="mt-5 text-lg text-neutral-700 max-w-md leading-relaxed">
              $100,000 in virtual cash and real market prices, so you can
              finally find out if you&apos;re actually good at this, or just
              lucky.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-coral-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-coral-500/20 hover:bg-coral-600 active:scale-[0.97] transition-all"
              >
                Open Dashboard
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-full bg-white/70 backdrop-blur px-6 py-3 text-base font-semibold text-neutral-900 border border-neutral-900/10 hover:bg-white transition-all active:scale-[0.97]"
              >
                How It Works
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="perspective-container relative h-[360px] hidden lg:block"
          >
            {/* Real component (components/trading/PricingBreakdown.tsx),
                not a copy - this is the exact same markup OrderConfirmModal
                shows before a real trade confirms, so it can't drift from
                the product the way a hand-matched lookalike could. */}
            <TiltCard
              intensity={7}
              className="glass-panel absolute top-2 right-2 w-80 rounded-2xl overflow-hidden"
            >
              <p className="px-5 pt-5 text-xs text-neutral-400 uppercase tracking-wide">
                Buy AAPL, for example
              </p>
              <div className="p-5 pt-3 [&_#tour-confirm-pricing]:bg-transparent [&_#tour-confirm-pricing]:p-0">
                <PricingBreakdown
                  action="BUY"
                  shares={1}
                  quotedPrice={310.22}
                  fillPrice={310.31}
                  spreadCost={0.09}
                  slippageCost={0.02}
                  total={310.33}
                />
              </div>
            </TiltCard>

            {/* Real Card primitive, real audited figure - not a lookalike
                of any specific live component, just the same $100,000
                starting-cash fact already stated in the copy above and in
                StatsBand. */}
            <Card
              padding="detail"
              className="glass-panel !bg-white/55 absolute bottom-4 left-2 w-64 rounded-2xl float-slow"
            >
              <div className="flex items-center gap-2 text-coral-700">
                <Wallet size={18} />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Starting cash
                </span>
              </div>
              <p className="num mt-2 text-3xl font-bold text-neutral-900">
                $100,000.00
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
