import { LineChart, Bot, ShieldCheck } from "lucide-react";
import { ScrollReveal, ScrollRevealItem } from "./ScrollReveal";

export default function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-white py-24">
      <ScrollReveal className="max-w-7xl mx-auto px-4 sm:px-6">
        <ScrollRevealItem index={0}>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 max-w-xl">
            Everything you need to learn the market
          </h2>
        </ScrollRevealItem>

        <div className="mt-10 grid md:grid-cols-2 gap-5">
          <ScrollRevealItem index={1} className="md:col-span-2">
            <div className="ocean-gradient-hero rounded-3xl p-8 md:p-10 relative overflow-hidden">
              <div className="relative z-10 max-w-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-seafoam-600 shadow-sm">
                  <LineChart size={20} />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-neutral-900">
                  Honest execution
                </h3>
                <p className="mt-2 text-neutral-700 leading-relaxed">
                  A quote isn&apos;t a fill. We model the spread and slippage
                  that separate them, so you&apos;re not practicing against
                  prices that don&apos;t exist.
                </p>
              </div>
              <div className="absolute right-6 bottom-0 top-0 hidden md:flex items-end pb-8 gap-2 opacity-70">
                {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
                  <div
                    key={i}
                    className="w-4 rounded-t-full bg-seafoam-500"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </ScrollRevealItem>

          <ScrollRevealItem index={2} direction="left">
            <div className="rounded-3xl p-8 bg-coral-50 h-full">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral-500 text-white shadow-sm">
                <Bot size={20} />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-neutral-900">
                Krix, your AI co-pilot
              </h3>
              <p className="mt-2 text-neutral-700 leading-relaxed">
                Ask questions, research a stock, or let Krix propose a full
                trade plan you review before it executes.
              </p>
            </div>
          </ScrollRevealItem>

          <ScrollRevealItem index={2} direction="right">
            <div className="rounded-3xl p-8 bg-sand-100 h-full">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sand-600 text-white shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-neutral-900">
                Beat the S&amp;P 500
              </h3>
              <p className="mt-2 text-neutral-700 leading-relaxed">
                Every portfolio here is measured against just buying the
                index. Good returns don&apos;t mean much if an index fund
                would have beaten you anyway.
              </p>
            </div>
          </ScrollRevealItem>
        </div>
      </ScrollReveal>
    </section>
  );
}
