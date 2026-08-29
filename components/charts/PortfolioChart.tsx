"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import Card from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

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
  const lineColor = isPositive ? "#16a34a" : "#dc2626";

  return (
    <Card>
      <h2 className="text-lg font-semibold text-neutral-900 mb-3">
        {usingFallback
          ? "Portfolio Value (recorded this session onward)"
          : "Portfolio Value Since First Trade"}
      </h2>

      {loading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length < 2 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
          <Clock size={15} className="flex-shrink-0 text-neutral-400" />
          <p>Not enough data yet to draw a chart.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <XAxis
              dataKey="label"
              stroke="#a3a3a3"
              fontSize={12}
              interval={Math.max(Math.floor(data.length / 6), 0)}
            />
            <YAxis
              stroke="#a3a3a3"
              fontSize={12}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#171717" }}
              formatter={(value) => [`$${formatMoney(Number(value))}`, "Value"]}
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
    </Card>
  );
}