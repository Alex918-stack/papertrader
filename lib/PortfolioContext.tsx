"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { Holding, Transaction, PortfolioState } from "@/types/portfolio";

export const STARTING_CASH = 100000;
const STORAGE_KEY = "ai-paper-trader:portfolio";

interface PortfolioContextValue extends PortfolioState {
  buy: (symbol: string, shares: number, price: number) => { success: boolean; message: string };
  sell: (symbol: string, shares: number, price: number) => { success: boolean; message: string };
  resetPortfolio: () => void;
  syncStatus: "local" | "syncing" | "synced" | "error";
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

function defaultState(): PortfolioState {
  return { cash: STARTING_CASH, holdings: [], transactions: [] };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [cash, setCash] = useState(STARTING_CASH);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "synced" | "error">("local");

// Load data once we know whether the user is signed in or not
  useEffect(() => {
    if (status === "loading") return;

    async function load() {
      if (status === "authenticated") {
        setSyncStatus("syncing");
        try {
          const res = await fetch("/api/sync/portfolio");
          if (res.ok) {
            const { data } = await res.json();
            const state = data ?? defaultState();
            setCash(state.cash);
            setHoldings(state.holdings);
            setTransactions(state.transactions);
            setSyncStatus("synced");
          } else {
            setSyncStatus("error");
          }
        } catch {
          setSyncStatus("error");
        }
      } else {
        // Signed out (or never signed in): always start fresh, no local persistence
        const fresh = defaultState();
        setCash(fresh.cash);
        setHoldings(fresh.holdings);
        setTransactions(fresh.transactions);
        localStorage.removeItem(STORAGE_KEY);
        setSyncStatus("local");
      }
      setHasLoaded(true);
    }

    load();
  }, [status]);

// Save whenever data changes, after initial load - only persists when signed in
  useEffect(() => {
    if (!hasLoaded) return;
    if (status !== "authenticated") return;

    const state: PortfolioState = { cash, holdings, transactions };
    setSyncStatus("syncing");
    fetch("/api/sync/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
      .then((res) => setSyncStatus(res.ok ? "synced" : "error"))
      .catch(() => setSyncStatus("error"));
  }, [cash, holdings, transactions, hasLoaded, status]);

  function buy(symbol: string, shares: number, price: number) {
    const cost = shares * price;

    if (shares <= 0) {
      return { success: false, message: "Enter a valid number of shares." };
    }
    if (cost > cash) {
      return { success: false, message: "Not enough cash for this trade." };
    }

    setCash((prev) => prev - cost);

    setHoldings((prev) => {
      const existing = prev.find((h) => h.symbol === symbol);
      if (existing) {
        const totalShares = existing.shares + shares;
        const totalCost = existing.avgCost * existing.shares + cost;
        return prev.map((h) =>
          h.symbol === symbol
            ? { ...h, shares: totalShares, avgCost: totalCost / totalShares }
            : h
        );
      }
      return [...prev, { symbol, shares, avgCost: price }];
    });

    logTransaction(symbol, "BUY", shares, price, cost);
    return { success: true, message: `Bought ${shares} shares of ${symbol}.` };
  }

  function sell(symbol: string, shares: number, price: number) {
    const existing = holdings.find((h) => h.symbol === symbol);

    if (shares <= 0) {
      return { success: false, message: "Enter a valid number of shares." };
    }
    if (!existing || existing.shares < shares) {
      return { success: false, message: "Not enough shares to sell." };
    }

    const proceeds = shares * price;
    setCash((prev) => prev + proceeds);

    setHoldings((prev) =>
      prev
        .map((h) =>
          h.symbol === symbol ? { ...h, shares: h.shares - shares } : h
        )
        .filter((h) => h.shares > 0)
    );

    logTransaction(symbol, "SELL", shares, price, proceeds);
    return { success: true, message: `Sold ${shares} shares of ${symbol}.` };
  }

  function logTransaction(
    symbol: string,
    type: "BUY" | "SELL",
    shares: number,
    price: number,
    total: number
  ) {
    setTransactions((prev) => [
      {
        id: crypto.randomUUID(),
        symbol,
        type,
        shares,
        price,
        total,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
  }

function resetPortfolio() {
    setCash(STARTING_CASH);
    setHoldings([]);
    setTransactions([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <PortfolioContext.Provider
      value={{ cash, holdings, transactions, buy, sell, resetPortfolio, syncStatus }}
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