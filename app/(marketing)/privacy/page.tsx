import type { Metadata } from "next";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — AI Paper Trader",
  description:
    "What AI Paper Trader collects, why, and who it's shared with.",
};

// One edit point. Google requires a working contact on the OAuth consent
// screen, and it must match what's published here.
const CONTACT_EMAIL = "alexandersteck7@gmail.com";

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-neutral-900 pt-4">{children}</h2>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 2026">
      <p>
        AI Paper Trader is a paper trading simulator. This page explains what
        we collect, why, and who we share it with.
      </p>
      <p className="font-medium text-neutral-900">
        AI Paper Trader is a simulation. No real money is ever involved. We are
        not a broker, we do not execute real trades, and we never handle funds
        or payment information.
      </p>

      <H>What we collect</H>
      <p>
        <strong className="text-neutral-900">From your Google account, when you sign in.</strong>{" "}
        We use Google Sign-In. Google gives us your email address, your name,
        and your profile picture. We never receive your Google password or
        access anything else in your account.
      </p>
      <p>
        <strong className="text-neutral-900">What you do in the app.</strong>{" "}
        Your simulated portfolio — virtual cash, positions, and trade history.
        The trade theses you write about why you're making a trade, and your
        reflections when you close a position. Your conversations with Krix,
        our AI assistant.
      </p>
      <p>
        <strong className="text-neutral-900">Automatically.</strong> A session
        cookie so you stay signed in, and your IP address, used only to prevent
        abuse of our rate limits.
      </p>
      <p>
        We do not collect payment information, financial account details,
        government identification, or any real financial data. There is nothing
        to collect, because no real money exists in this product.
      </p>

      <H>If you don&apos;t sign in</H>
      <p>
        You can use AI Paper Trader without an account. If you do,{" "}
        <strong className="text-neutral-900">nothing you do is saved.</strong>{" "}
        Your portfolio exists only in your browser&apos;s memory and disappears
        when you reload the page. We store nothing about you except a temporary
        IP-based rate-limit record.
      </p>

      <H>How we use it</H>
      <p>
        To run your account and keep your portfolio available across devices, to
        power Krix, to generate feedback on your trading decisions, and to
        prevent abuse. We do not sell your data, share it with advertisers, or
        use it to build advertising profiles.
      </p>

      <H>Who we share it with</H>
      <p>
        We use these services to run the app. Each has its own privacy policy.
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong className="text-neutral-900">Supabase</strong> — database and
          authentication. Receives all account and trading data.
        </li>
        <li>
          <strong className="text-neutral-900">Vercel</strong> — application
          hosting. Receives standard web request data.
        </li>
        <li>
          <strong className="text-neutral-900">Google</strong> — Google Sign-In.
        </li>
        <li>
          <strong className="text-neutral-900">Google Gemini</strong> — powers
          Krix.
        </li>
      </ul>
      <p>
        <strong className="text-neutral-900">Worth being explicit about Gemini:</strong>{" "}
        when you ask Krix about your portfolio, we send your holdings, cash
        balance, and recent trades to Google&apos;s Gemini API so it can answer.
        Your trade theses are also sent when generating feedback on a closed
        position. If you&apos;d rather that data not be processed by Google,
        don&apos;t use the assistant — the rest of the app works without it.
      </p>
      <p>
        We also use Finnhub and Twelve Data for market prices. These receive{" "}
        <strong className="text-neutral-900">only stock symbols</strong>, never
        anything about you.
      </p>
      <p>We may disclose information if legally required to do so.</p>

      <H>How long we keep it</H>
      <p>
        Your data stays until you delete it. Resetting your portfolio in
        Settings permanently deletes your positions, trade history, and journal,
        including every thesis and critique. That cannot be undone.
      </p>
      <p>
        To delete your account entirely, use{" "}
        <strong className="text-neutral-900">Settings → Delete Account</strong>.
        This removes your account and all associated data permanently.
      </p>

      <H>Your choices</H>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong className="text-neutral-900">See your data</strong> — most of
          it is visible in the app: portfolio, trade history, journal, chat.
        </li>
        <li>
          <strong className="text-neutral-900">Delete your trading data</strong>{" "}
          — Settings → Reset Portfolio.
        </li>
        <li>
          <strong className="text-neutral-900">Delete everything</strong> —
          Settings → Delete Account.
        </li>
        <li>
          <strong className="text-neutral-900">Revoke Google access</strong> —
          through your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral-600 underline underline-offset-2"
          >
            Google account permissions
          </a>{" "}
          at any time.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have additional rights over your
        personal data. Email us and we&apos;ll honor any request we&apos;re able
        to.
      </p>

      <H>Security</H>
      <p>
        Data is stored in Supabase with row-level security, meaning the database
        itself enforces that you can only read and write your own records — it
        isn&apos;t left to application code. Connections are encrypted. That
        said, no system is perfectly secure, and we can&apos;t guarantee
        absolute security.
      </p>

      <H>Age</H>
      <p>
        AI Paper Trader is not intended for anyone under 13. We don&apos;t
        knowingly collect information from children under 13. If you believe a
        child has given us information, email us and we&apos;ll delete it.
      </p>

      <H>Analytics and tracking</H>
      <p>
        We don&apos;t use third-party analytics, advertising trackers, or
        cross-site tracking. The only cookie we set is the one that keeps you
        signed in.
      </p>

      <H>Changes</H>
      <p>
        We may update this policy. Material changes will be reflected in the
        &quot;Last updated&quot; date above.
      </p>

      <H>Contact</H>
      <p>
        Questions about this policy or your data:{" "}
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
