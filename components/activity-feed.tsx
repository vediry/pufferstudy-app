"use client";

import * as React from "react";
import { Sparkles, Pencil, Paperclip, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityEvent } from "@/lib/activity";
import { renderActivity, type ActivityIconKey } from "@/lib/activity-text";
import { formatRelativeTime } from "@/lib/desk";

const ICONS: Record<ActivityIconKey, LucideIcon> = {
  gen: Sparkles,
  edit: Pencil,
  upload: Paperclip,
  new: Plus,
};

export function ActivityFeed() {
  const [events, setEvents] = React.useState<ActivityEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/activity?limit=10", { cache: "no-store" });
        if (!res.ok) throw new Error(`activity ${res.status}`);
        const data = (await res.json()) as { events: ActivityEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load activity.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="glow-card border border-default bg-surface p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Recent activity</p>

      {error ? (
        <p className="text-sm text-ink-muted">{error}</p>
      ) : events === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse bg-surface-2/60" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity yet. Generate a cheat sheet or chat about one to see updates here.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const r = renderActivity(event);
            const Icon = ICONS[r.iconKey];
            return (
              <li key={event.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-default bg-surface-2 text-ink-muted">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="text-sm leading-snug text-ink">
                  {r.text}
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
