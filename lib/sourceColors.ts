const COLORS = [
  { bg: "bg-seafoam-100", text: "text-seafoam-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-coral-100", text: "text-coral-800" },
];

export function colorForSource(source: string) {
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}