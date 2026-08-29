"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useAuth } from "@/components/layout/AuthProvider";
import { useJournal } from "@/components/journal/JournalProvider";
import { createClient } from "@/lib/supabase/client";
import { Holding, Transaction, PortfolioState } from "@/types/portfolio";
import {
  computeExecutionPricing,
  fetchSymbolLiquidity,
  ExecutionPricing,
} from "@/lib/executionPricing";
import { STARTING_CASH } from "@/lib/constants";
import { shareWord } from "@/lib/format";

// Re-exported for existing importers (e.g. components/charts/PortfolioChart.tsx)
// - the value itself now lives in lib/constants.ts, since the benchmark
// route needs it too and can't import from a "use client" module.
export { STARTING_CASH };

type TradeResult = {
  success: boolean;
  message: string;
  /** Set only when this trade was the sell that fully closed a position - lets callers show a "position closed" toast linking into the journal, and is what triggers a critique generation request. Never set for guests, who have no episodes. */
  closedEpisodeId?: string;
};

// whyThis/whyNow/invalidation are only ever sent on the trade that opens a
// new position (add-ons and sells use note instead) - but they're optional
// there too, not required. execute_trade records whatever it's given,
// including nothing at all, and never asks again: a null thesis at open
// stays null permanently, so there's no "add one later" path to design
// around here.
export interface TradeThesis {
  whyThis?: string;
  whyNow?: string;
  invalidation?: string;
  invalidationPrice?: number;
  note?: string;
}

interface PortfolioContextValue extends PortfolioState {
  // quotedPrice, not price: the caller supplies the last-trade quote it
  // fetched (e.g. from useStockQuotes) - trade() below is what turns that
  // into an actual fill price via lib/executionPricing.ts, so nothing
  // upstream of it deals in a raw, un-adjusted "price" anymore.
  buy: (symbol: string, shares: number, quotedPrice: number, thesis?: TradeThesis) => Promise<TradeResult>;
  sell: (symbol: string, shares: number, quotedPrice: number, thesis?: TradeThesis) => Promise<TradeResult>;
  resetPortfolio: () => Promise<TradeResult>;
  syncStatus: "local" | "syncing" | "synced" | "error";
  loading: boolean;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

function defaultState(): PortfolioState {
  return { cash: STARTING_CASH, holdings: [], transactions: [] };
}

// Postgres exceptions raised with a plain message (raise exception
// 'Insufficient cash') come back through supabase-js as error.message
// verbatim, so these already read as user-facing text - no mapping needed.
function tradeErrorMessage(raw: string): string {
  return raw || "Trade failed. Please try again.";
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  // JournalProvider sits above PortfolioProvider (app/layout.tsx)
  // specifically so this call is possible - this is the one place that
  // knows exactly when position_episodes rows change (a trade opens or
  // closes one, a reset deletes all of them), so it's the one place that
  // calls journal.refetch() rather than journal guessing via polling.
  const journal = useJournal();
  const [cash, setCash] = useState(STARTING_CASH);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "synced" | "error">("local");

  // Buy/sell need to validate against the *latest* cash/holdings even when called
  // several times back-to-back (e.g. the AI executing a multi-trade plan) before
  // React has re-rendered with the previous trade's state - refs give an immediately
  // consistent source of truth that setState alone can't during a tight sequential loop.
  // Only used on the signed-out (in-memory) path now; the signed-in path's source of
  // truth is Postgres itself, re-read after every write.
  const cashRef = useRef(cash);
  const holdingsRef = useRef(holdings);
  useEffect(() => {
    cashRef.current = cash;
  }, [cash]);
  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  // Reads the signed-in user's current portfolio straight from Postgres.
  // Four independent queries, none needs an explicit user filter - RLS
  // already narrows every one of them to rows this user owns. The fourth
  // (thesis-bearing episode ids) is a small, separate query rather than an
  // embedded position_episodes(...) join on transactions - simple enough
  // on its own not to need the join.
  async function fetchFromServer() {
    const supabase = createClient();
    const [portfolioRes, holdingsRes, transactionsRes, thesisEpisodesRes] = await Promise.all([
      supabase.from("portfolios").select("cash").single(),
      supabase.from("holdings").select("symbol, shares, avg_cost"),
      supabase
        .from("transactions")
        .select(
          "id, symbol, type, shares, price, total, executed_at, quoted_price, spread_cost, slippage_cost, episode_id"
        )
        .order("executed_at", { ascending: false }),
      supabase.from("position_episodes").select("id").not("thesis_why_this", "is", null),
    ]);

    if (portfolioRes.error || holdingsRes.error || transactionsRes.error || thesisEpisodesRes.error) {
      throw new Error(
        portfolioRes.error?.message ??
          holdingsRes.error?.message ??
          transactionsRes.error?.message ??
          thesisEpisodesRes.error?.message ??
          "Failed to load portfolio"
      );
    }

    const thesisEpisodeIds = new Set((thesisEpisodesRes.data ?? []).map((e) => e.id));

    // Postgres `numeric` columns are serialized as strings over the wire
    // (PostgREST does this deliberately, to avoid silently losing precision
    // that doesn't fit in a JS float) - every one of these needs an explicit
    // Number() rather than being trusted as already-numeric.
    return {
      cash: Number(portfolioRes.data?.cash ?? STARTING_CASH),
      holdings: (holdingsRes.data ?? []).map(
        (h): Holding => ({
          symbol: h.symbol,
          shares: Number(h.shares),
          avgCost: Number(h.avg_cost),
        })
      ),
      transactions: (transactionsRes.data ?? []).map(
        (t): Transaction => ({
          id: t.id,
          symbol: t.symbol,
          type: t.type.toUpperCase() as "BUY" | "SELL",
          shares: Number(t.shares),
          price: Number(t.price),
          total: Number(t.total),
          timestamp: new Date(t.executed_at).getTime(),
          // Genuinely null on trades from before execution modeling shipped -
          // Number(null) would be 0, which is a different claim, so each of
          // these only converts when the source value isn't null.
          quotedPrice: t.quoted_price === null ? null : Number(t.quoted_price),
          spreadCost: t.spread_cost === null ? null : Number(t.spread_cost),
          slippageCost: t.slippage_cost === null ? null : Number(t.slippage_cost),
          episodeId: t.episode_id,
          episodeHasThesis: t.episode_id !== null && thesisEpisodeIds.has(t.episode_id),
        })
      ),
    };
  }

  // Load once we know whether the user is signed in or not, and whenever
  // that status changes (sign in / sign out while the app is open).
  useEffect(() => {
    if (status === "loading") return;

    let ignore = false;

    async function load() {
      setLoading(true);

      if (status === "authenticated") {
        setSyncStatus("syncing");
        try {
          const state = await fetchFromServer();
          if (ignore) return;
          setCash(state.cash);
          setHoldings(state.holdings);
          setTransactions(state.transactions);
          setSyncStatus("synced");
        } catch {
          if (ignore) return;
          setSyncStatus("error");
        }
      } else {
        // Signed out: in-memory only, on purpose - see the guest notice in
        // the UI. Nothing is written to or read from anywhere; state simply
        // starts fresh every time status isn't "authenticated".
        const fresh = defaultState();
        if (ignore) return;
        setCash(fresh.cash);
        setHoldings(fresh.holdings);
        setTransactions(fresh.transactions);
        setSyncStatus("local");
      }

      if (!ignore) setLoading(false);
    }

    load();

    return () => {
      ignore = true;
    };
  }, [status]);

  async function trade(
    symbol: string,
    action: "BUY" | "SELL",
    shares: number,
    quotedPrice: number,
    thesis?: TradeThesis
  ): Promise<TradeResult> {
    if (shares <= 0) {
      return { success: false, message: "Enter a valid number of shares." };
    }

    // The one place fill price and execution cost are computed for a real
    // trade - see lib/executionPricing.ts's file header. Fetched fresh here
    // rather than trusting anything the caller might already have, same
    // reasoning as executeTradePlan.ts re-fetching price instead of trusting
    // a plan proposed earlier in the conversation.
    const liquidity = await fetchSymbolLiquidity(symbol);
    const pricing = computeExecutionPricing({
      quotedPrice,
      side: action,
      shares,
      liquidity,
    });

    if (status !== "authenticated") {
      return tradeInMemory(symbol, action, shares, pricing);
    }

    // Checked against the pre-trade snapshot, before execute_trade runs:
    // once we know (below) the trade actually succeeded, execute_trade's
    // own "Insufficient shares" check guarantees shares <= the real
    // existing amount, so combined with this >= check, a success here can
    // only mean shares was exactly the full existing position - i.e. this
    // sell is about to close it. Used only to decide whether the
    // closed-episode lookup after the RPC call is worth making.
    const existingHolding = holdingsRef.current.find((h) => h.symbol === symbol);
    const wouldFullyClose =
      action === "SELL" && !!existingHolding && existingHolding.shares <= shares;
    // Same "checked before the RPC, against the pre-trade snapshot" shape
    // as wouldFullyClose above - a BUY with no existing holding is exactly
    // when execute_trade (0008) inserts a brand new position_episodes row,
    // the other moment journal data changes besides a close.
    const wouldOpenNewPosition = action === "BUY" && !existingHolding;

    const supabase = createClient();
    const { error } = await supabase.rpc("execute_trade", {
      p_symbol: symbol,
      p_action: action.toLowerCase(),
      p_shares: shares,
      p_price: pricing.fillPrice,
      p_quoted_price: pricing.quotedPrice,
      p_spread_cost: pricing.spreadCost,
      p_slippage_cost: pricing.slippageCost,
      p_thesis_why_this: thesis?.whyThis || undefined,
      p_thesis_why_now: thesis?.whyNow || undefined,
      p_thesis_invalidation: thesis?.invalidation || undefined,
      p_thesis_invalidation_price: thesis?.invalidationPrice ?? undefined,
      p_note: thesis?.note || undefined,
    });

    if (error) {
      return { success: false, message: tradeErrorMessage(error.message) };
    }

    // Fire-and-forget, same philosophy as the critique POST just below:
    // never block the trade result the user is waiting on. journal's own
    // episodes list is stale the instant a new one is opened or an
    // existing one closes - this is the one place that knows which just
    // happened.
    if (wouldFullyClose || wouldOpenNewPosition) {
      void journal.refetch();
    }

    let closedEpisodeId: string | undefined;
    if (wouldFullyClose) {
      const { data: closedEpisode } = await supabase
        .from("position_episodes")
        .select("id")
        .eq("symbol", symbol)
        .not("closed_at", "is", null)
        .order("closed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      closedEpisodeId = closedEpisode?.id;

      // Best-effort, fire-and-forget: Krix's critique is generated once,
      // right when the episode closes - not on this request's own timeline,
      // and never blocking the trade result the user is waiting on. If it
      // fails (network hiccup, LLM error), the journal page's own retry
      // button covers it later.
      if (closedEpisodeId) {
        void fetch("/api/journal/critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId: closedEpisodeId }),
        }).catch(() => {});
      }
    }

    // Re-read rather than optimistically recompute client-side: execute_trade
    // already did the real math once, inside the transaction that's now
    // committed. Re-deriving the same math here a second time in JS is
    // exactly the kind of two-places-that-can-disagree risk this migration
    // was meant to remove, so the client just asks Postgres what happened.
    try {
      const state = await fetchFromServer();
      setCash(state.cash);
      setHoldings(state.holdings);
      setTransactions(state.transactions);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }

    const verb = action === "BUY" ? "Bought" : "Sold";
    return {
      success: true,
      message: `${verb} ${shares} ${shareWord(shares)} of ${symbol}.`,
      closedEpisodeId,
    };
  }

  // pricing is already fully computed by trade() before this is called -
  // the guest path applies exactly the same fill price and cost breakdown
  // the signed-in path sends to execute_trade, because both branch from the
  // one computeExecutionPricing call in trade() rather than each computing
  // their own.
  function tradeInMemory(
    symbol: string,
    action: "BUY" | "SELL",
    shares: number,
    pricing: ExecutionPricing
  ): TradeResult {
    const price = pricing.fillPrice;
    const cost = shares * price;

    if (action === "BUY") {
      if (cost > cashRef.current) {
        return { success: false, message: "Not enough cash for this trade." };
      }

      cashRef.current = cashRef.current - cost;
      setCash(cashRef.current);

      const existing = holdingsRef.current.find((h) => h.symbol === symbol);
      const nextHoldings = existing
        ? holdingsRef.current.map((h) => {
            if (h.symbol !== symbol) return h;
            const totalShares = h.shares + shares;
            const totalCost = h.avgCost * h.shares + cost;
            return { ...h, shares: totalShares, avgCost: totalCost / totalShares };
          })
        : [...holdingsRef.current, { symbol, shares, avgCost: price }];
      holdingsRef.current = nextHoldings;
      setHoldings(nextHoldings);

      logLocalTransaction(symbol, "BUY", shares, pricing, cost);
      return { success: true, message: `Bought ${shares} ${shareWord(shares)} of ${symbol}.` };
    }

    const existing = holdingsRef.current.find((h) => h.symbol === symbol);
    if (!existing || existing.shares < shares) {
      return { success: false, message: "Not enough shares to sell." };
    }

    cashRef.current = cashRef.current + cost;
    setCash(cashRef.current);

    const nextHoldings = holdingsRef.current
      .map((h) => (h.symbol === symbol ? { ...h, shares: h.shares - shares } : h))
      .filter((h) => h.shares > 0);
    holdingsRef.current = nextHoldings;
    setHoldings(nextHoldings);

    logLocalTransaction(symbol, "SELL", shares, pricing, cost);
    return { success: true, message: `Sold ${shares} ${shareWord(shares)} of ${symbol}.` };
  }

  function logLocalTransaction(
    symbol: string,
    type: "BUY" | "SELL",
    shares: number,
    pricing: ExecutionPricing,
    total: number
  ) {
    setTransactions((prev) => [
      {
        id: crypto.randomUUID(),
        symbol,
        type,
        shares,
        price: pricing.fillPrice,
        total,
        timestamp: Date.now(),
        quotedPrice: pricing.quotedPrice,
        spreadCost: pricing.spreadCost,
        slippageCost: pricing.slippageCost,
        // Guests have no position_episodes at all - nothing persists, so
        // there's never an episode to point at.
        episodeId: null,
        episodeHasThesis: false,
      },
      ...prev,
    ]);
  }

  async function buy(symbol: string, shares: number, quotedPrice: number, thesis?: TradeThesis) {
    return trade(symbol, "BUY", shares, quotedPrice, thesis);
  }

  async function sell(symbol: string, shares: number, quotedPrice: number, thesis?: TradeThesis) {
    return trade(symbol, "SELL", shares, quotedPrice, thesis);
  }

  async function resetPortfolio(): Promise<TradeResult> {
    if (status !== "authenticated") {
      const fresh = defaultState();
      cashRef.current = fresh.cash;
      holdingsRef.current = fresh.holdings;
      setCash(fresh.cash);
      setHoldings(fresh.holdings);
      setTransactions(fresh.transactions);
      return { success: true, message: "Portfolio reset to $100,000 starting cash." };
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("reset_portfolio");

    if (error) {
      return { success: false, message: tradeErrorMessage(error.message) };
    }

    try {
      const state = await fetchFromServer();
      setCash(state.cash);
      setHoldings(state.holdings);
      setTransactions(state.transactions);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }

    // Awaited, unlike the fire-and-forget refetch in trade() - this is
    // exactly the bug that shipped without it: reset_portfolio (0011)
    // deletes every episode server-side, but journal's stale snapshot kept
    // showing a closed one as if it still existed, so Settings' "existing
    // activity" check never cleared right after a reset. The whole point
    // of this call is that it's true by the time this function returns,
    // not eventually true later.
    await journal.refetch();

    return { success: true, message: "Portfolio reset to $100,000 starting cash." };
  }

  return (
    <PortfolioContext.Provider
      value={{ cash, holdings, transactions, buy, sell, resetPortfolio, syncStatus, loading }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
}
