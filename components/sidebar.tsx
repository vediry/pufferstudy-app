"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  NotebookPen,
  ClipboardList,
  Layers,
  HelpCircle,
  BookText,
  GraduationCap,
  Network,
  MoreHorizontal,
} from "lucide-react";
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
  { label: "Assignments", href: "/assignments", icon: ClipboardList, matchPrefix: "/assignments" },
  { label: "Guides", href: "/study-guides", icon: BookText, matchPrefix: "/study-guides" },
  { label: "Flashcards", href: "/flashcards", icon: Layers, matchPrefix: "/flashcards" },
  { label: "Practice", href: "/practice", icon: HelpCircle, matchPrefix: "/practice" },
  { label: "Tutor", href: "/tutor", icon: GraduationCap, matchPrefix: "/tutor" },
  { label: "Diagrams", href: "/diagrams", icon: Network, matchPrefix: "/diagrams" },
];

// Desktop sidebar groups the destinations into labelled sections.
// (MobileNav shows a few primary tabs + a "More" overflow — see below.)
const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  { heading: "Workspace", items: NAV.slice(0, 3) },
  { heading: "Study tools", items: NAV.slice(3) },
];

// Mobile bottom bar shows these four; everything else folds into "More".
const MOBILE_PRIMARY_HREFS = ["/", "/notepad", "/flashcards", "/practice"];

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
 * Desktop: labelled, grouped sidebar on the left (~212px). Sits below the AppBar
 * (which owns the wordmark), so the rail itself is just the grouped destinations.
 * Mobile: horizontal bottom bar (rendered as <MobileNav/> separately so the
 * desktop sticky-aside math doesn't fight the mobile fixed positioning).
 */
export function Sidebar() {
  const isActive = useIsActive();

  return (
    <aside
      className="no-print sticky top-16 z-30 hidden h-[calc(100dvh-4rem)] w-[212px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-default bg-[color:var(--surface)] px-3 py-5 md:flex"
      aria-label="Primary navigation"
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <span className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            {group.heading}
          </span>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`glow-on-hover group flex items-center gap-3 rounded-[10px] px-3 py-2 transition-colors ${
                  active
                    ? "bg-surface-2 text-[color:var(--accent-deep)]"
                    : "text-ink-muted hover:text-ink"
                }`}
                style={active ? activeGlow() : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
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
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Close the overflow sheet whenever the route changes.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const primary = MOBILE_PRIMARY_HREFS.map((href) =>
    NAV.find((n) => n.href === href),
  ).filter((n): n is NavItem => !!n);
  const overflow = NAV.filter((n) => !MOBILE_PRIMARY_HREFS.includes(n.href));
  const overflowActive = overflow.some((item) => isActive(item));

  const linkClass = (activeItem: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 rounded-[10px] px-3 py-2 text-[11px] font-semibold transition-colors ${
      activeItem
        ? "bg-surface-2 text-[color:var(--accent-deep)]"
        : "text-ink-muted active:text-ink"
    }`;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-default bg-[color:var(--surface)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary navigation"
    >
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 -z-10 cursor-default bg-transparent"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-full inset-x-0 border-t border-default bg-[color:var(--surface)] p-2">
            <div className="mx-auto grid max-w-[420px] grid-cols-4 gap-1">
              {overflow.map((item) => {
                const Icon = item.icon;
                const activeItem = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activeItem ? "page" : undefined}
                    className={linkClass(activeItem)}
                    style={activeItem ? activeGlow() : undefined}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <div className="mx-auto flex max-w-[420px] items-stretch justify-around px-2 py-1.5">
        {primary.map((item) => {
          const Icon = item.icon;
          const activeItem = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeItem ? "page" : undefined}
              className={linkClass(activeItem)}
              style={activeItem ? activeGlow() : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="More"
          onClick={() => setMoreOpen((o) => !o)}
          className={linkClass(overflowActive || moreOpen)}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
          <span className="leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
