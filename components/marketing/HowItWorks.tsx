import { ScrollReveal, ScrollRevealItem } from "./ScrollReveal";

const STEPS = [
  {
    number: "01",
    title: "Sign in, get $100,000",
    body: "Create an account and your paper portfolio is funded instantly. No card, no risk.",
  },
  {
    number: "02",
    title: "Research with Krix",
    body: "Pull real quotes, read the news, and ask Krix to explain what you're looking at.",
  },
  {
    number: "03",
    title: "Trade and track it",
    body: "Place an order yourself, or approve Krix's plan. Write down why before you trade, then let Krix grade your reasoning once you close the position.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-sand-100 py-24">
      <ScrollReveal className="max-w-7xl mx-auto px-4 sm:px-6">
        <ScrollRevealItem index={0}>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 max-w-xl">
            Three steps to your first trade
          </h2>
        </ScrollRevealItem>

        <div className="mt-12 grid md:grid-cols-3 gap-10">
          {STEPS.map((step, i) => (
            <ScrollRevealItem key={step.number} index={i + 1}>
              <span className="text-5xl font-bold text-seafoam-400/70 tabular-nums">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-neutral-900">
                {step.title}
              </h3>
              <p className="mt-2 text-neutral-600 leading-relaxed">
                {step.body}
              </p>
            </ScrollRevealItem>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
