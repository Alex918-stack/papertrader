export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number; // average price paid per share
}

export interface Transaction {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  shares: number;
  /** The actual fill price - post-spread/slippage once execution modeling shipped, the raw quote verbatim on trades from before that. */
  price: number;
  total: number;
  timestamp: number;
  /**
   * Execution detail, all three present together or all three null - never
   * partially populated. Null on every trade recorded before honest
   * execution modeling shipped (mirrors transactions_execution_detail_all_or_nothing
   * in supabase/migrations/0007_execution_costs.sql). Render null as
   * genuinely absent, not as zero - "no data" and "modeled as zero cost"
   * are different claims.
   */
  quotedPrice: number | null;
  spreadCost: number | null;
  slippageCost: number | null;
  /** Which position episode this trade belongs to - null for trades before episode tracking shipped, or against a position already open before it shipped. */
  episodeId: string | null;
  /** True only if episodeId is set AND that episode's thesis is non-null - what the trade-history indicator uses to decide whether to show a journal link. */
  episodeHasThesis: boolean;
}

export interface PortfolioState {
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
}