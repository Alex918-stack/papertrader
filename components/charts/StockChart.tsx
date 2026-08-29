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
import { loadHistory, HistoryPoint } from "@/lib/priceHistory";
import { formatMoney } from "@/lib/format";
import { fetchWithPendingRetry } from "@/lib/fetchMarketData";
import { relativeTime } from "@/lib/relativeTime";
import Card from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

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
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setUsingFallback(false);
      setStaleAsOf(null);

      try {
        const json = (await fetchWithPendingRetry(
          `/api/stocks?symbol=${symbol}&type=candles&days=${range}`,
          controller.signal
        )) as { status: string; points?: { date: string; close: number }[]; asOf?: string };

        if (json.status !== "unavailable" && (json.points?.length ?? 0) > 1) {
          const useMonthLabel = range > 90;
          setData(
            json.points!.map((p) => ({
              label: new Date(p.date).toLocaleDateString([], {
                month: "short",
                day: useMonthLabel ? undefined : "numeric",
                year: range > 180 ? "2-digit" : undefined,
              }),
              price: p.close,
            }))
          );
          if (json.status === "stale" && json.asOf) setStaleAsOf(json.asOf);
          setLoading(false);
          return;
        }
      } catch {
        // fall through to local fallback
      }

      if (!controller.signal.aborted) {
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
      controller.abort();
    };
  }, [symbol, range]);

  const isPositive =
    data.length >= 2 ? data[data.length - 1].price >= data[0].price : true;
  const lineColor = isPositive ? "#16a34a" : "#dc2626";
  const percentChange =
    data.length >= 2
      ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
      : 0;

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            {usingFallback
              ? "Price History (recorded this session onward)"
              : "Price History"}
          </h2>
          {data.length >= 2 && (
            <span
              className={`text-sm font-medium ${
                isPositive ? "text-green-700" : "text-red-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {percentChange.toFixed(2)}%
            </span>
          )}
          {staleAsOf && (
            <span
              className="flex items-center gap-1 text-xs text-neutral-400"
              title={`Last updated ${new Date(staleAsOf).toLocaleString()}`}
            >
              <Clock size={12} className="flex-shrink-0" />
              as of {relativeTime(new Date(staleAsOf).getTime() / 1000)}
            </span>
          )}
        </div>

        {!usingFallback && (
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full active:scale-[0.97] transition-all duration-150 ease-out-quart ${
                  range === r.days
                    ? "bg-coral-50 text-coral-800"
                    : "text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-[250px] w-full" />
      ) : data.length < 2 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
          <Clock size={15} className="flex-shrink-0 text-neutral-400" />
          <p>
            Not enough recorded history yet for {symbol}. Keep checking back -
            we&apos;re building this chart from real prices as you use the app.
          </p>
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
              formatter={(value) => [`$${formatMoney(Number(value))}`, "Price"]}
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
    </Card>
  );
}