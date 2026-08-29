import Link from "next/link";
import { ScrollReveal, ScrollRevealItem } from "./ScrollReveal";

export default function FinalCTA() {
  return (
    <section className="bg-white py-24">
      <ScrollReveal className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <ScrollRevealItem index={0}>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900">
            Start trading today
          </h2>
        </ScrollRevealItem>
        <ScrollRevealItem index={1}>
          <p className="mt-3 text-neutral-600">
            Your $100,000 portfolio is waiting. No card, no risk.
          </p>
        </ScrollRevealItem>
        <ScrollRevealItem index={2}>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full bg-coral-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-coral-500/20 hover:bg-coral-600 active:scale-[0.97] transition-all"
            >
              Open Dashboard
            </Link>
          </div>
        </ScrollRevealItem>
      </ScrollReveal>
    </section>
  );
}
