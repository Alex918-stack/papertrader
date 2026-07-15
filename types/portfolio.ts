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
  price: number;
  total: number;
  timestamp: number;
}

export interface PortfolioState {
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
}