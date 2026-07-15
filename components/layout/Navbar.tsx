"use client";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-neutral-400 hover:text-neutral-100 p-2 rounded-md hover:bg-neutral-800"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <span className="font-semibold text-neutral-100">
          AI Paper Trader
        </span>
      </div>

      <div className="flex-1 max-w-md mx-4">
        <input
          type="text"
          placeholder="Search stocks..."
          className="w-full bg-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 rounded-md px-3 py-1.5 border border-neutral-700 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}