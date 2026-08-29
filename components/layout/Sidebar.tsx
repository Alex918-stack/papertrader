"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Bot,
  BookOpen,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trading", href: "/trading", icon: TrendingUp },
  { label: "Portfolio", href: "/portfolio", icon: Briefcase },
  { label: "Krix", href: "/ai", icon: Bot },
  { label: "Journal", href: "/journal", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  /** Desktop persistent sidebar: icon-only rail vs full width. */
  desktopCollapsed: boolean;
  /** Mobile overlay drawer: hidden off-canvas vs shown over a scrim. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ desktopCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 sm:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`h-full bg-white border-r border-neutral-200 transition-all duration-200 z-40
          fixed sm:static top-14 sm:top-0 left-0
          ${mobileOpen ? "translate-x-0 w-56" : "-translate-x-full"}
          sm:translate-x-0 ${desktopCollapsed ? "sm:w-16" : "sm:w-56"}
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
                onClick={onCloseMobile}
                title={item.label}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-coral-50 text-coral-800"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                } ${desktopCollapsed ? "sm:justify-center sm:px-0" : ""}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={desktopCollapsed ? "sm:hidden" : ""}>
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