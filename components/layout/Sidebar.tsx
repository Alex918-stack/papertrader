"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Trading", href: "/trading" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "AI Assistant", href: "/ai" },
  { label: "News", href: "/news" },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`h-full bg-neutral-900 border-r border-neutral-800 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              } ${collapsed ? "text-center px-0" : ""}`}
            >
              {collapsed ? item.label.charAt(0) : item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}