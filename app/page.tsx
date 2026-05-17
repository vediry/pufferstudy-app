"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubjectCard } from "@/components/subject-card";
import { DashboardEmptyState } from "@/components/empty-state";
import { MigrationBanner } from "@/components/migration-banner";
import { useSubjects } from "@/lib/cloud-subjects";

export default function DashboardPage() {
  const { subjects, error, refresh } = useSubjects();

  React.useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const ready = subjects !== null;
  const items = subjects ?? [];

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[2.25rem]">
            Your study desk
          </h1>
          <p className="text-[15px] text-ink-muted sm:text-base">
            Each subject collects the photos and notes for one class or unit.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/subjects/new">
            <Plus />
            New subject
          </Link>
        </Button>
      </div>

      <MigrationBanner onMigrated={refresh} />

      {error ? (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-default bg-surface-2 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!ready ? (
        <SubjectSkeletonGrid />
      ) : items.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {items.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} fileCount={0} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[148px] animate-pulse rounded-[var(--radius-lg)] border border-default bg-surface-2/60"
        />
      ))}
    </div>
  );
}
