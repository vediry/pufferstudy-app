"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookText,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  BookOpen,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Puffer } from "@/components/puffer";
import { Reveal } from "@/components/motion/reveal";
import { useSubjects, type Subject } from "@/lib/cloud-subjects";
import { formatRelativeTime } from "@/lib/desk";

export default function StudyGuidesPage() {
  const { subjects, error } = useSubjects();

  const withGuide: Subject[] = React.useMemo(
    () => (subjects ?? []).filter((s) => !!s.studyGuideMarkdown && !s.archived),
    [subjects],
  );
  const withoutGuide: Subject[] = React.useMemo(
    () => (subjects ?? []).filter((s) => !s.studyGuideMarkdown && !s.archived),
    [subjects],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Study Guides
        </h1>
        <p className="max-w-prose text-sm text-ink-muted sm:text-base">
          Long-form learning notes per subject. Different from the cheat sheet — these explain
          concepts, walk through examples, and call out common pitfalls.
        </p>
      </header>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
          <p className="flex-1 text-ink">{error}</p>
        </div>
      ) : null}

      {subjects === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-32 rounded-[18px]" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <NoSubjects />
      ) : (
        <>
          {withGuide.length > 0 ? (
            <section className="mb-8 flex flex-col gap-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Your guides ({withGuide.length})
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {withGuide.map((s, i) => (
                  <Reveal key={s.id} index={i}>
                    <GuideCard subject={s} />
                  </Reveal>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {withGuide.length > 0 ? "Start a new guide" : "Get started"}
            </h2>
            {withoutGuide.length === 0 ? (
              <p className="rounded-[12px] border border-default bg-surface-2/40 px-4 py-6 text-center text-sm text-ink-muted">
                Every subject already has a guide. Add a new subject from the Study Desk to start another.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {withoutGuide.map((s) => (
                  <SubjectRow key={s.id} subject={s} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function NoSubjects() {
  return (
    <div className="glow-card flex flex-col items-center gap-3 border border-default border-dashed bg-surface-2/40 px-6 py-16 text-center">
      <Puffer size={96} />
      <h2
        className="text-[1.4rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        No subjects yet
      </h2>
      <p className="max-w-md text-sm text-ink-muted">
        Study guides are generated from your subjects&apos; notes. Add a subject first, then
        upload some material — guides come from there.
      </p>
      <Button asChild>
        <Link href="/subjects/new">
          Add a subject
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
    </div>
  );
}

function GuideCard({ subject }: { subject: Subject }) {
  return (
    <article className="glow-card group flex flex-col gap-3 border border-default bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <BookText className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <Badge tone="accent">Guide ready</Badge>
      </header>

      <div className="flex flex-col gap-1">
        <h3
          className="text-[1.25rem] leading-tight text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {subject.name}
        </h3>
        {subject.studyGuideGeneratedAt ? (
          <p className="tabular text-[12px] text-ink-faint">
            Updated {formatRelativeTime(subject.studyGuideGeneratedAt)}
          </p>
        ) : null}
      </div>

      <Button asChild className="mt-auto">
        <Link href={`/study-guides/${subject.id}`}>
          Open guide
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
    </article>
  );
}

function SubjectRow({ subject }: { subject: Subject }) {
  const hasFiles = subject.fileCount > 0;
  return (
    <div className="glow-card flex items-center gap-3 border border-default bg-surface p-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-default"
        style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
      >
        <BookOpen className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-ink">
          {subject.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
          {hasFiles ? (
            <>
              <FileText className="h-3 w-3" strokeWidth={2} />
              {subject.fileCount} {subject.fileCount === 1 ? "file" : "files"} uploaded
            </>
          ) : (
            "No files uploaded yet"
          )}
        </p>
      </div>

      <Button asChild size="sm" variant={hasFiles ? "primary" : "secondary"}>
        <Link href={`/study-guides/${subject.id}`}>
          {hasFiles ? (
            <>
              <Sparkles />
              Generate
            </>
          ) : (
            <>
              Set up
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </>
          )}
        </Link>
      </Button>
    </div>
  );
}
