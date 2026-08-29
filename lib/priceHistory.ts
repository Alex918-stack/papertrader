export interface HistoryPoint {
  timestamp: number;
  value: number;
}

const MAX_POINTS = 500;

function getKey(id: string) {
  return `ai-paper-trader:history:${id}`;
}

export function recordPoint(id: string, value: number) {
  if (typeof window === "undefined") return;

  try {
    const existing = loadHistory(id);
    const now = Date.now();

    const lastPoint = existing[existing.length - 1];
    if (lastPoint && now - lastPoint.timestamp < 60_000) {
      return;
    }

    const updated = [...existing, { timestamp: now, value }].slice(
      -MAX_POINTS
    );
    localStorage.setItem(getKey(id), JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to record history point:", err);
  }
}

export function loadHistory(id: string): HistoryPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(getKey(id));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function mergeHistories(
  a: HistoryPoint[],
  b: HistoryPoint[]
): HistoryPoint[] {
  const combined = [...a, ...b];
  const seen = new Set<number>();
  const deduped = combined.filter((point) => {
    if (seen.has(point.timestamp)) return false;
    seen.add(point.timestamp);
    return true;
  });
  return deduped.sort((a, b) => a.timestamp - b.timestamp).slice(-500);
}