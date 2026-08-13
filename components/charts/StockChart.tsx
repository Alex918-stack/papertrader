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
import { loadHistory, HistoryPoint } from "@/lib/priceHistory";

interface StockChartProps {
  symbol: string;
}

interface ChartPoint {
  label: string;
  price: number;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

export default function StockChart({ symbol }: StockChartProps) {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setUsingFallback(false);

      try {
        const res = await fetch(
          `/api/stocks?symbol=${symbol}&type=candles&days=${range}`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.points?.length > 1) {
            const useMonthLabel = range > 90;
            setData(
              json.points.map((p: { date: string; close: number }) => ({
                label: new Date(p.date).toLocaleDateString([], {
                  month: "short",
                  day: useMonthLabel ? undefined : "numeric",
                  year: range > 180 ? "2-digit" : undefined,
                }),
                price: p.close,
              }))
            );
            setLoading(false);
            return;
          }
        }
      } catch {
        // fall through to local fallback
      }

      if (!cancelled) {
        const local: HistoryPoint[] = loadHistory(symbol);
        setData(
          local.map((point) => ({
            label: new Date(point.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            price: point.value,
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
  }, [symbol, range]);

  const isPositive =
    data.length >= 2 ? data[data.length - 1].price >= data[0].price : true;
  const lineColor = isPositive ? "#10b981" : "#ef4444";
  const percentChange =
    data.length >= 2
      ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
      : 0;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-100">
            {usingFallback
              ? "Price History (recorded this session onward)"
              : "Price History"}
          </h2>
          {data.length >= 2 && (
            <span
              className={`text-sm font-medium ${
                isPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {percentChange.toFixed(2)}%
            </span>
          )}
        </div>

        {!usingFallback && (
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  range === r.days
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-neutral-500 hover:bg-neutral-800"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 py-8 text-center">
          Loading price history...
        </p>
      ) : data.length < 2 ? (
        <p className="text-sm text-neutral-500 py-8 text-center">
          Not enough recorded history yet for {symbol}. Keep checking back -
          we're building this chart from real prices as you use the app.
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
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
            />
            <Line
              type="monotone"
              dataKey="price"
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