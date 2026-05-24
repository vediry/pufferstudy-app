"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { TodayPanel } from "@/components/today-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { UpcomingTimeline } from "@/components/upcoming-timeline";
import { SubjectsGrid } from "@/components/subjects-grid";
import { useSubjects } from "@/lib/cloud-subjects";
import { useAssignments } from "@/lib/cloud-assignments";

export default function DeskPage() {
  const { subjects: loaded, error, refresh } = useSubjects();
  const { assignments } = useAssignments();
  const { user } = useUser();

  // Local mirror so optimistic archive updates don't wait for refresh.
  const [subjects, setSubjects] = React.useState<typeof loaded>(loaded);
  React.useEffect(() => { setSubjects(loaded); }, [loaded]);

  React.useEffect(() => {
    function onFocus() { refresh(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const ready = subjects !== null;
  const items = subjects ?? [];
  const activeCount = items.filter((s) => !s.archived).length;

  const greetingName = user?.firstName ?? "back";
  const focus = items.find((s) => !s.archived && s.testDate);
  const focusSummary = focus ? ` · ${focus.name} test soon` : "";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            Welcome back,{" "}
            <span className="italic" style={{ color: "var(--accent-deep)" }}>
              {greetingName}
            </span>
          </h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Your study desk · {activeCount} active {activeCount === 1 ? "subject" : "subjects"}{focusSummary}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/subjects/new">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New subject
          </Link>
        </Button>
      </header>

      {error ? (
        <div className="mb-6 border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      {!ready ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-1" />
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-1 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <TodayPanel subjects={items} assignments={assignments ?? []} />
            <ActivityFeed />
          </aside>
          <section className="flex flex-col gap-4 lg:col-span-2">
            <UpcomingTimeline subjects={items} assignments={assignments ?? []} />
            <SubjectsGrid
              subjects={items}
              onSubjectsChange={(updater) =>
                setSubjects((prev) => (prev ? updater(prev) : prev))
              }
            />
          </section>
        </div>
      )}
    </div>
  );
}
