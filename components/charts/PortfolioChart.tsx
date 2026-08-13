"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePortfolio, STARTING_CASH } from "@/lib/PortfolioContext";
import { reconstructPortfolioHistory } from "@/lib/portfolioHistory";
import { loadHistory, HistoryPoint } from "@/lib/priceHistory";

export default function PortfolioChart() {
  const { transactions } = usePortfolio();
  const [data, setData] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [noTrades, setNoTrades] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (transactions.length === 0) {
        if (!cancelled) {
          setNoTrades(true);
          setLoading(false);
        }
        return;
      }
      setNoTrades(false);

      const reconstructed = await reconstructPortfolioHistory(
        transactions,
        STARTING_CASH
      );

      if (!cancelled && reconstructed) {
        setData(
          reconstructed.map((p) => ({
            label: new Date(p.date).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            }),
            value: p.value,
          }))
        );
        setUsingFallback(false);
        setLoading(false);
        return;
      }

      if (!cancelled) {
        const local: HistoryPoint[] = loadHistory("portfolio-total");
        setData(
          local.map((point) => ({
            label: new Date(point.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            value: point.value,
          }))
        );
        setUsingFallback(true);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  if (noTrades) {
    return null;
  }

  const isPositive =
    data.length >= 2 ? data[data.length - 1].value >= data[0].value : true;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-neutral-100 mb-3">
        {usingFallback
          ? "Portfolio Value (recorded this session onward)"
          : "Portfolio Value Since First Trade"}
      </h2>

      {loading ? (
        <p className="text-sm text-neutral-500 py-8 text-center">
          Loading portfolio history...
        </p>
      ) : data.length < 2 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">
          Not enough data yet to draw a chart.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <XAxis
              dataKey="label"
              stroke="#737373"
              fontSize={12}
              interval={Math.max(Math.floor(data.length / 6), 0)}
            />
            <YAxis
              stroke="#737373"
              fontSize={12}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#171717",
                border: "1px solid #404040",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#e5e5e5" }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Value"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}