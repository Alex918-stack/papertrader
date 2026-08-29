import { ScrollReveal, ScrollRevealItem } from "./ScrollReveal";

const STATS = [
  { value: "$100,000", label: "Starting virtual cash", isNumeric: true },
  { value: "170+", label: "Tradable stocks", isNumeric: true },
  { value: "S&P 500", label: "Always benchmarked", isNumeric: false },
];

export default function StatsBand() {
  return (
    <section className="ocean-gradient-deep py-16">
      <ScrollReveal className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/15">
          {STATS.map((stat, i) => (
            <ScrollRevealItem
              key={stat.label}
              index={i}
              className="py-6 sm:py-0 sm:px-8 text-center first:pt-0 sm:first:pl-0"
            >
              <p className={`text-4xl font-bold text-white ${stat.isNumeric ? "num" : ""}`}>
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-seafoam-100">{stat.label}</p>
            </ScrollRevealItem>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
