const COLORS = [
  { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  { bg: "bg-sky-500/20", text: "text-sky-400" },
  { bg: "bg-violet-500/20", text: "text-violet-400" },
  { bg: "bg-amber-500/20", text: "text-amber-400" },
  { bg: "bg-rose-500/20", text: "text-rose-400" },
  { bg: "bg-cyan-500/20", text: "text-cyan-400" },
];

export function colorForSource(source: string) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}