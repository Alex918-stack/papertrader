"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Bot,
  Newspaper,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Trading", href: "/trading", icon: TrendingUp },
  { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  { label: "AI Assistant", href: "/ai", icon: Bot },
  { label: "News", href: "/news", icon: Newspaper },
];

interface SidebarProps {
  collapsed: boolean;
  onClose: () => void;
}

export default function Sidebar({ collapsed, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`h-full bg-neutral-900 border-r border-neutral-800 transition-all duration-200 z-40
          fixed sm:static top-14 sm:top-0 left-0
          ${collapsed ? "-translate-x-full sm:translate-x-0 sm:w-16" : "translate-x-0 w-56"}
        `}
      >
        <nav className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                } ${collapsed ? "sm:justify-center sm:px-0" : ""}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={collapsed ? "sm:hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}