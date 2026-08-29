import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="ocean-gradient-deep">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-seafoam-50">
          Paper trading only, not real money. Market data may be delayed.
        </p>
        <div className="flex items-center gap-6 text-sm text-seafoam-100">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
