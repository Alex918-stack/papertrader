"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useToast } from "@/components/ui/ToastProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { resetPortfolio, syncStatus } = usePortfolio();
  const { showToast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  function handleReset() {
    resetPortfolio();
    showToast("Portfolio reset to $100,000 starting cash.");
    setConfirmReset(false);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
<Button>Test Button</Button>
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
          Account
        </h2>
        {status === "authenticated" ? (
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <p className="text-neutral-100 font-medium">
                {session.user?.name}
              </p>
              <p className="text-sm text-neutral-500">
                {session.user?.email}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Not signed in</p>
        )}

        <div className="flex gap-2 pt-2">
          {status === "authenticated" ? (
            <button
              onClick={() => signOut()}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Sign in with Google
            </button>
          )}
        </div>

        {status === "authenticated" && (
          <p className="text-xs text-neutral-600 pt-1">
            Sync status:{" "}
            <span
              className={
                syncStatus === "synced"
                  ? "text-emerald-500"
                  : syncStatus === "error"
                  ? "text-red-500"
                  : "text-neutral-500"
              }
            >
              {syncStatus}
            </span>
          </p>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide">
          Portfolio
        </h2>
        <p className="text-sm text-neutral-500">
          Reset your paper trading portfolio back to $100,000 in cash, with
          no holdings and no trade history. This cannot be undone.
        </p>
        {confirmReset ? (
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Yes, reset everything
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="bg-neutral-800 hover:bg-red-900/40 hover:text-red-400 text-neutral-300 text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            Reset Portfolio
          </button>
        )}
      </div>
    </div>
  );
}