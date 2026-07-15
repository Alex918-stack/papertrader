"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Holding, Transaction, PortfolioState } from "@/types/portfolio";

const STARTING_CASH = 100000;
const STORAGE_KEY = "ai-paper-trader:portfolio";

interface PortfolioContextValue extends PortfolioState {
  buy: (symbol: string, shares: number, price: number) => { success: boolean; message: string };
  sell: (symbol: string, shares: number, price: number) => { success: boolean; message: string };
  resetPortfolio: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

function loadFromStorage(): PortfolioState {
  if (typeof window === "undefined") {
    return { cash: STARTING_CASH, holdings: [], transactions: [] };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error("Failed to load portfolio from storage:", err);
  }
  return { cash: STARTING_CASH, holdings: [], transactions: [] };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [cash, setCash] = useState(STARTING_CASH);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load saved data once, when the app first mounts in the browser
  useEffect(() => {
    const saved = loadFromStorage();
    setCash(saved.cash);
    setHoldings(saved.holdings);
    setTransactions(saved.transactions);
    setHasLoaded(true);
  }, []);

  // Save to localStorage every time cash, holdings, or transactions change
  useEffect(() => {
    if (!hasLoaded) return; // don't overwrite storage before initial load finishes
    const state: PortfolioState = { cash, holdings, transactions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [cash, holdings, transactions, hasLoaded]);

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
      value={{ cash, holdings, transactions, buy, sell, resetPortfolio }}
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