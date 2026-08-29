import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — AI Paper Trader",
  description:
    "The terms you agree to by using AI Paper Trader, a paper trading simulator.",
};

const CONTACT_EMAIL = "alexandersteck7@gmail.com";

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-neutral-900 pt-4">{children}</h2>
  );
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 2026">
      <p>
        By using AI Paper Trader, you agree to these terms. If you don&apos;t
        agree, don&apos;t use it.
      </p>

      <H>What this is</H>
      <p className="font-medium text-neutral-900">
        AI Paper Trader is an educational simulator. It uses real market prices
        and entirely fake money. No real securities are ever bought or sold, no
        real funds are ever held or transferred, and nothing here is a
        brokerage account.
      </p>
      <p>
        We are not a broker-dealer, not an investment adviser, and not a
        financial institution.
      </p>

      <H>Not financial advice</H>
      <p>
        Nothing in this app is investment advice, a recommendation to buy or
        sell any security, or a solicitation of any kind. That includes
        everything produced by Krix, our AI assistant — its research summaries,
        its trade plan suggestions, and its critiques of your reasoning are
        educational output, not advice.
      </p>
      <p>
        Krix is an AI. It can be wrong, incomplete, or out of date. Verify
        anything that matters before acting on it, and consult a licensed
        professional before making real financial decisions.
      </p>

      <H>Simulated results mean nothing about real results</H>
      <p>
        Simulated performance does not predict real performance. Our fill engine
        models estimated spread and slippage to be more realistic than a naive
        simulator, but those are{" "}
        <strong className="text-neutral-900">estimates</strong>, not real
        executions. Real trading involves costs, delays, liquidity constraints,
        taxes, and emotional pressure that no simulation reproduces.
      </p>
      <p>
        Doing well here does not mean you would do well with real money. It is
        the most common mistake paper traders make.
      </p>

      <H>Market data</H>
      <p>
        Market data is provided by third parties and may be delayed, incomplete,
        or inaccurate. We don&apos;t guarantee its accuracy and aren&apos;t
        liable for decisions made in reliance on it. Data is for personal,
        non-commercial use only, and you may not redistribute it.
      </p>

      <H>Your account</H>
      <p>
        You need a Google account to save anything. You&apos;re responsible for
        activity under your account. Don&apos;t share it, don&apos;t impersonate
        anyone, and don&apos;t create accounts on someone else&apos;s behalf
        without permission.
      </p>
      <p>You must be at least 13 years old to use AI Paper Trader.</p>

      <H>Acceptable use</H>
      <p>Don&apos;t:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Scrape, resell, or redistribute market data obtained through the app</li>
        <li>Attempt to bypass rate limits, authentication, or access other users&apos; data</li>
        <li>Use the app to develop a competing product</li>
        <li>Upload unlawful, abusive, or harmful content, including in trade theses</li>
        <li>Automate access in a way that degrades service for others</li>
      </ul>

      <H>Your content</H>
      <p>
        Your trade theses, reflections, and chat messages belong to you. You give
        us permission to store and process them to operate the app — which
        includes sending them to our AI provider to generate critiques, as
        described in the{" "}
        <Link
          href="/privacy"
          className="text-coral-600 underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>
      <p>
        One thing to understand before you write your first thesis:{" "}
        <strong className="text-neutral-900">
          theses are permanent and cannot be edited
        </strong>
        . That is deliberate — a thesis you can revise after seeing the outcome
        isn&apos;t evidence of anything. You can delete a thesis by resetting
        your portfolio or deleting your account, but you can never change one.
      </p>

      <H>Availability</H>
      <p>
        We provide this app as-is, with no guarantee of uptime, and we may
        change or discontinue it at any time. It runs on free-tier
        infrastructure and third-party APIs with rate limits. It will sometimes
        be slow or unavailable.
      </p>

      <H>No warranty</H>
      <p>
        The app is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <H>Limitation of liability</H>
      <p>
        To the fullest extent permitted by law, we are not liable for any
        indirect, incidental, consequential, or punitive damages, or for any
        financial loss arising from your use of the app — including decisions
        you make in real markets influenced by anything you saw here. Our total
        liability will not exceed the amount you have paid us, which is zero.
      </p>

      <H>Termination</H>
      <p>
        You can delete your account at any time in Settings. We may suspend or
        terminate accounts that violate these terms.
      </p>

      <H>Changes</H>
      <p>
        We may update these terms. Material changes will be reflected in the
        &quot;Last updated&quot; date above. Continuing to use the app after a
        change means you accept it.
      </p>

      <H>Governing law</H>
      <p>
        These terms are governed by the laws of the State of New York, without
        regard to conflict of law principles.
      </p>

      <H>Contact</H>
      <p>
        Questions:{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-coral-600 underline underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </LegalPage>
  );
}
