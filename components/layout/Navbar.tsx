"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getDisplayName, getAvatarUrl } from "@/lib/supabase/userDisplay";
import Link from "next/link";
import Image from "next/image";
import { Menu, Search } from "lucide-react";
import { ALL_ASSETS } from "@/lib/stockSymbols";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const { user, status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return ALL_ASSETS.filter(
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

  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`,
      },
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
  }

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const initial = displayName ? displayName[0]!.toUpperCase() : "?";

  return (
    <header className="h-14 bg-white border-b border-neutral-200 shadow-sm flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-neutral-500 hover:text-neutral-900 active:scale-[0.9] transition-transform duration-150 ease-out-quart p-2 rounded-md hover:bg-neutral-100"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <Link
          href="/"
          className="font-semibold text-neutral-900 hover:text-coral-600 transition-colors"
        >
          AI Paper Trader
        </Link>
      </div>

      <div className="relative flex-1 max-w-md mx-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            placeholder="Search stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={handleKeyDown}
            className="w-full bg-neutral-100 text-sm text-neutral-900 placeholder-neutral-400 rounded-md pl-9 pr-3 py-1.5 border border-transparent focus:outline-none focus:bg-white focus:border-coral-400"
          />
        </div>

        {searchOpen && results.length > 0 && (
          <div className="dropdown-enter absolute left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden z-40">
            {results.map((s) => (
              <button
                key={s.symbol}
                onClick={() => goToStock(s.symbol)}
                className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <span className="font-medium text-neutral-900">{s.symbol}</span>
                <span className="text-neutral-400 ml-2">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {status === "authenticated" ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="relative w-8 h-8 rounded-full bg-seafoam-100 text-seafoam-700 flex items-center justify-center text-sm font-medium overflow-hidden ring-2 ring-transparent hover:ring-coral-200 active:scale-[0.9] transition-all duration-150 ease-out-quart"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="32px" className="object-cover" />
            ) : (
              initial
            )}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="dropdown-enter absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-md shadow-lg z-40 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          disabled={status === "loading"}
          className="inline-flex items-center rounded-full bg-coral-500 hover:bg-coral-600 disabled:opacity-0 text-white text-sm font-medium px-4 py-1.5 active:scale-[0.97] transition-all"
        >
          Sign in with Google
        </button>
      )}
    </header>
  );
}
