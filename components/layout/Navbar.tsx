"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search } from "lucide-react";
import { ALL_STOCKS } from "@/lib/stockSymbols";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return ALL_STOCKS.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search]);

  function goToStock(symbol: string) {
    router.push(`/stocks/${symbol}`);
    setSearch("");
    setSearchOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results.length > 0) {
      goToStock(results[0].symbol);
    }
  }

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-neutral-400 hover:text-neutral-100 p-2 rounded-md hover:bg-neutral-800"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <span className="font-semibold text-neutral-100">
          AI Paper Trader
        </span>
      </div>

      <div className="relative flex-1 max-w-md mx-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            type="text"
            placeholder="Search stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={handleKeyDown}
            className="w-full bg-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 rounded-md pl-9 pr-3 py-1.5 border border-neutral-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {searchOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg overflow-hidden z-40">
            {results.map((s) => (
              <button
                key={s.symbol}
                onClick={() => goToStock(s.symbol)}
                className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <span className="font-medium">{s.symbol}</span>
                <span className="text-neutral-500 ml-2">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium overflow-hidden"
        >
          {status === "authenticated" && session.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            "U"
          )}
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-md shadow-lg z-40 overflow-hidden">
              {status === "authenticated" ? (
                <>
                  <div className="px-4 py-3 border-b border-neutral-800">
                    <p className="text-sm font-medium text-neutral-100 truncate">
                      {session.user?.name}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {session.user?.email}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="w-full text-left px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}