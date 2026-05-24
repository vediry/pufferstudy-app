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

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (item: NavItem): boolean => {
      if (item.href === "/") return pathname === "/";
      return item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href;
    },
    [pathname],
  );
}

function activeGlow(): React.CSSProperties {
  return {
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent), 0 0 14px -2px color-mix(in srgb, var(--accent) 40%, transparent)",
  };
}

/**
 * Desktop: narrow vertical rail on the left.
 * Mobile: horizontal bottom bar (rendered as <MobileNav/> separately so the
 * desktop sticky-aside math doesn't fight the mobile fixed positioning).
 */
export function Sidebar() {
  const isActive = useIsActive();

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
            style={active ? activeGlow() : undefined}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}

/**
 * Bottom navigation bar shown on mobile (below md).
 * Fixed to the bottom of the viewport; safe-area-padded so it clears iOS home indicator.
 * Pages should add bottom padding (pb-24 or similar) so content isn't hidden behind it.
 */
export function MobileNav() {
  const isActive = useIsActive();

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-default bg-[color:var(--surface)]/90 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-[420px] items-stretch justify-around px-2 py-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-[10px] px-3 py-2 text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-surface-2 text-[color:var(--accent-deep)]"
                  : "text-ink-muted active:text-ink"
              }`}
              style={active ? activeGlow() : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
