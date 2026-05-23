"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, NotebookPen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const NAV: NavItem[] = [
  { label: "Study Desk", href: "/", icon: LayoutGrid, matchPrefix: "/" },
  { label: "Notepad", href: "/notepad", icon: NotebookPen, matchPrefix: "/notepad" },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if (item.href === "/") return pathname === "/";
    return item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href;
  }

  return (
    <aside
      className="no-print sticky top-16 z-30 hidden h-[calc(100dvh-4rem)] w-[72px] shrink-0 flex-col items-center gap-1 border-r border-default py-4 md:flex"
      aria-label="Primary navigation"
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={item.label}
            className={`glow-on-hover group flex w-[56px] flex-col items-center gap-1 rounded-[10px] px-1 py-2 transition-colors ${
              active
                ? "bg-surface-2 text-[color:var(--accent-deep)]"
                : "text-ink-muted hover:text-ink"
            }`}
            style={
              active
                ? {
                    boxShadow:
                      "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent), 0 0 14px -2px color-mix(in srgb, var(--accent) 40%, transparent)",
                  }
                : undefined
            }
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
