"use client";

import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useToast } from "@/components/ui/ToastProvider";
import PageHeroHeader from "@/components/layout/PageHeroHeader";
import { useAuth } from "@/components/layout/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { getDisplayName, getAvatarUrl } from "@/lib/supabase/userDisplay";
import { useTour } from "@/components/tour/TourProvider";
import { TOUR_BEATS, TOUR_ENABLED } from "@/lib/tour";
import { useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function SettingsPage() {
  const { user, status } = useAuth();
  const { resetPortfolio, syncStatus } = usePortfolio();
  const { showToast } = useToast();
  const tour = useTour();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmReplayReset, setConfirmReplayReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleReset() {
    const result = await resetPortfolio();
    showToast(result.message, result.success ? "success" : "error");
    setConfirmReset(false);
  }

  function handleReplayClick() {
    // Replaying reflects real current state, same as everywhere else in
    // the tour - it doesn't restart from zero just because you clicked
    // it. If there's leftover activity on the tour symbol from a previous
    // run, starting now wouldn't land on the beginning; say so and offer
    // to reset first, rather than navigating to Trading and silently
    // doing nothing (the state-sharing bug this replaces produced exactly
    // that symptom for an unrelated reason - this guards the same visible
    // failure mode for a real, always-possible cause).
    if (tour.hasExistingActivity) {
      setConfirmReplayReset(true);
      return;
    }
    tour.start();
    router.push(TOUR_BEATS[0].page);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(
          body?.error ?? "We couldn't delete your account. Please try again.",
          "error"
        );
        setDeleting(false);
        return;
      }
      // The account is gone server-side; clear the local session so the app
      // doesn't keep acting signed-in against a user that no longer exists.
      await createClient().auth.signOut();
      router.push("/");
    } catch {
      showToast(
        "We couldn't delete your account. Please try again.",
        "error"
      );
      setDeleting(false);
    }
  }

  async function handleResetAndReplay() {
    const result = await resetPortfolio();
    if (!result.success) {
      showToast(result.message, "error");
      return;
    }
    setConfirmReplayReset(false);
    tour.start();
    router.push(TOUR_BEATS[0].page);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeroHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your account and paper trading portfolio."
      />
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Account</h2>
        {status === "authenticated" ? (
          <div className="flex items-center gap-3">
            {getAvatarUrl(user) && (
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <Image src={getAvatarUrl(user)!} alt="" fill sizes="48px" className="object-cover" />
              </div>
            )}
            <div>
              <p className="text-neutral-900 font-medium">
                {getDisplayName(user)}
              </p>
              <p className="text-sm text-neutral-500">{user?.email}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Not signed in</p>
        )}

        <div className="flex gap-2 pt-2">
          {status === "authenticated" ? (
            <Button onClick={() => createClient().auth.signOut()} variant="secondary">
              Sign out
            </Button>
          ) : (
            <Button
              onClick={() =>
                createClient().auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
                  },
                })
              }
              variant="primary"
            >
              Sign in with Google
            </Button>
          )}
        </div>

        {status === "authenticated" && (
          <p className="text-xs text-neutral-400 pt-1">
            Sync status:{" "}
            <span
              className={
                syncStatus === "synced"
                  ? "text-green-700"
                  : syncStatus === "error"
                  ? "text-red-600"
                  : "text-neutral-500"
              }
            >
              {syncStatus}
            </span>
          </p>
        )}
      </Card>

      {TOUR_ENABLED && status === "authenticated" && (
        <Card id="tour-settings-replay" className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Guided Tour</h2>
          <p className="text-sm text-neutral-500">
            Walk through one real trade again - pair this with Reset
            Portfolio below for a clean re-run.
          </p>
          {confirmReplayReset ? (
            <div className="space-y-2">
              <p className="text-sm text-sand-700">
                You still have activity on the tour&apos;s stock from before, so replaying now
                wouldn&apos;t start at the beginning. Reset your portfolio first for a clean run?
              </p>
              <div className="flex gap-2">
                <Button onClick={handleResetAndReplay} variant="danger">
                  Reset &amp; Replay
                </Button>
                <Button onClick={() => setConfirmReplayReset(false)} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleReplayClick} variant="secondary">
              Replay Tour
            </Button>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Portfolio</h2>
        <p className="text-sm text-neutral-500">
          This permanently deletes your positions, trade history, and
          journal, including every thesis and critique you&apos;ve
          written. Cash resets to $100,000. This cannot be undone.
        </p>
        {confirmReset ? (
          <div className="flex gap-2">
            <Button onClick={handleReset} variant="danger">
              Yes, reset everything
            </Button>
            <Button onClick={() => setConfirmReset(false)} variant="secondary">
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setConfirmReset(true)}
            variant="secondary"
            className="hover:bg-red-50 hover:text-red-600"
          >
            Reset Portfolio
          </Button>
        )}
      </Card>

      {status === "authenticated" && (
        <Card className="space-y-3 border-red-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            Delete account
          </h2>
          <p className="text-sm text-neutral-500">
            This permanently deletes your account and everything in it — your
            portfolio, trade history, journal, every thesis and critique
            you&apos;ve written, and all your conversations with Krix. It cannot
            be undone and there is no recovery.
          </p>
          {confirmDelete ? (
            <div className="space-y-3">
              <label className="block text-sm text-neutral-600">
                Type <span className="font-semibold text-neutral-900">DELETE</span>{" "}
                to confirm.
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  autoComplete="off"
                  className="mt-1.5 w-full max-w-xs bg-neutral-100 text-neutral-900 rounded-md px-3 py-2 text-sm border border-transparent focus:outline-none focus:bg-white focus:border-red-400"
                />
              </label>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAccount}
                  variant="danger"
                  disabled={deleteInput !== "DELETE" || deleting}
                >
                  {deleting ? "Deleting..." : "Permanently delete my account"}
                </Button>
                <Button
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteInput("");
                  }}
                  variant="secondary"
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setConfirmDelete(true)}
              variant="secondary"
              className="hover:bg-red-50 hover:text-red-600"
            >
              Delete account
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}