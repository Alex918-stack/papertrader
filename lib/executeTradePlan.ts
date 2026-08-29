import { StockQuote } from "@/hooks/useStockQuotes";
import { TradeThesis } from "@/lib/PortfolioContext";
import { Holding } from "@/types/portfolio";

export interface TradeToExecute {
  symbol: string;
  action: "BUY" | "SELL";
  shares: number;
  rationale?: string;
  /**
   * Only ever set client-side, right before execution, by whoever collected
   * it from the user (TradePlanThesisModal for AI-proposed opens,
   * OrderTicket for manual trades) - never by the AI itself. Stripped back
   * out before a TradeExecutionResult is built (see the loop below), so it
   * never ends up duplicated into messages.execution_results - the only
   * durable copy of a thesis is position_episodes, written by execute_trade.
   */
  thesis?: TradeThesis;
}

export interface TradeExecutionResult extends TradeToExecute {
  success: boolean;
  message: string;
  /**
   * Only meaningful when success is false. Writing several theses for a
   * multi-open plan can take minutes, and prices (and cash) move in that
   * window - a later leg failing because an earlier one already spent the
   * cash, or because a quote moved, is a completely different situation
   * from a real error (bad symbol, network failure, a rejected thesis) even
   * though both surface as "this trade didn't happen." Computed once here,
   * from the exact, known error strings PortfolioContext.trade() returns,
   * so the UI never has to re-guess it from message text itself.
   */
  failureReason?: "cash_shortfall" | "shares_shortfall" | "error";
  /** Set only when this leg was the sell that fully closed a position - see PortfolioContext.TradeResult. Just an id, not sensitive content, so unlike thesis it's fine to keep on the stored result. */
  closedEpisodeId?: string;
}

interface PortfolioActions {
  buy: (
    symbol: string,
    shares: number,
    price: number,
    thesis?: TradeThesis
  ) => Promise<{ success: boolean; message: string; closedEpisodeId?: string }>;
  sell: (
    symbol: string,
    shares: number,
    price: number,
    thesis?: TradeThesis
  ) => Promise<{ success: boolean; message: string; closedEpisodeId?: string }>;
}

// Matched against the exact strings PortfolioContext.trade() returns -
// 'Insufficient cash' / 'Insufficient shares' verbatim from execute_trade's
// raise exception, 'Not enough cash for this trade.' / 'Not enough shares
// to sell.' from the guest in-memory path. Not a guess at arbitrary error
// text - these are the specific, known messages that mean "portfolio state
// had moved by the time this leg ran," nothing else.
function classifyFailure(message: string): "cash_shortfall" | "shares_shortfall" | "error" {
  if (/insufficient cash|not enough cash/i.test(message)) return "cash_shortfall";
  if (/insufficient shares|not enough shares/i.test(message)) return "shares_shortfall";
  return "error";
}

/**
 * Which trades in a plan would open a brand-new position - a BUY in a
 * symbol not currently held, walked in order with a running set seeded
 * from real holdings so a plan that opens the same new symbol across two
 * separate legs only asks for a thesis on the first one (the second is
 * correctly an add-on to what the first leg just opened, not a second
 * open). Sells are never opening trades.
 */
export function getOpeningTradeIndexes(trades: TradeToExecute[], holdings: Holding[]): number[] {
  const held = new Set(holdings.map((h) => h.symbol));
  const indexes: number[] = [];
  trades.forEach((trade, i) => {
    if (trade.action === "BUY" && !held.has(trade.symbol)) {
      indexes.push(i);
      held.add(trade.symbol);
    }
  });
  return indexes;
}

/**
 * Runs a batch of trades sequentially against live prices, fetched fresh here
 * rather than trusting whatever price the AI saw when it proposed the plan.
 * Sequential on purpose: buy/sell validate against a running cash/holdings
 * total, so firing them concurrently could let two trades both "see" the same
 * starting cash and jointly overspend.
 */
export async function executeTradePlan(
  trades: TradeToExecute[],
  { buy, sell }: PortfolioActions
): Promise<TradeExecutionResult[]> {
  const results: TradeExecutionResult[] = [];

  for (const trade of trades) {
    const { thesis, ...tradeWithoutThesis } = trade;

    let price: number | null = null;
    try {
      const res = await fetch(`/api/stocks?symbol=${trade.symbol}`);
      if (res.ok) {
        const data: StockQuote = await res.json();
        price = data.price;
      }
    } catch {
      price = null;
    }

    if (!price || price <= 0) {
      results.push({
        ...tradeWithoutThesis,
        success: false,
        message: `Couldn't get a current price for ${trade.symbol} — skipped.`,
        failureReason: "error",
      });
      continue;
    }

    const outcome =
      trade.action === "BUY"
        ? await buy(trade.symbol, trade.shares, price, thesis)
        : await sell(trade.symbol, trade.shares, price, thesis);

    results.push({
      ...tradeWithoutThesis,
      success: outcome.success,
      message: outcome.message,
      failureReason: outcome.success ? undefined : classifyFailure(outcome.message),
      closedEpisodeId: outcome.closedEpisodeId,
    });
  }

  return results;
}
