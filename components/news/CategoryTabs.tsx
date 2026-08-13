interface CategoryTabsProps {
  active: string;
  onChange: (category: string) => void;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "merger", label: "M&A" },
];

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto thin-scrollbar pb-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            active === cat.value
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}