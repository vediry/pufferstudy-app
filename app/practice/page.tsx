"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  BookOpen,
  TrendingUp,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubjects, type Subject } from "@/lib/cloud-subjects";
import { getSettings } from "@/lib/store";
import {
  generateQuiz,
  usePracticeStats,
  type PracticeStats,
} from "@/lib/cloud-practice";
import { formatRelativeTime } from "@/lib/desk";

export default function PracticePage() {
  const { subjects } = useSubjects();
  const { stats, error: statsError, refresh: refreshStats } = usePracticeStats();
  const router = useRouter();
  const [generatingFor, setGeneratingFor] = React.useState<string | null>(null);
  const [genError, setGenError] = React.useState<string | null>(null);

  async function handleGenerate(subject: Subject) {
    const apiKey = getSettings().geminiKey;
    if (!apiKey) {
      setGenError("Add your Gemini API key in Settings to generate quizzes.");
      return;
    }
    if (!subject.cheatsheetMarkdown) {
      setGenError(`Generate a cheat sheet for ${subject.name} first.`);
      return;
    }
    setGenError(null);
    setGeneratingFor(subject.id);
    try {
      const quiz = await generateQuiz(subject.id, apiKey);
      router.push(`/practice/${quiz.id}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Couldn't generate the quiz.");
      setGeneratingFor(null);
    }
  }

  const eligibleSubjects = React.useMemo(() => {
    if (!subjects) return [];
    return subjects.filter((s) => !s.archived && s.cheatsheetMarkdown);
  }, [subjects]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Practice
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          AI-generated quizzes from each subject&apos;s cheat sheet. Track your accuracy and see which topics need more work.
        </p>
      </header>

      {(statsError || genError) ? (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
          <p className="flex-1 text-ink">{genError ?? statsError}</p>
        </div>
      ) : null}

      <StatsRow stats={stats} />

      {stats && stats.weakest.length > 0 ? (
        <ImprovementSection stats={stats} />
      ) : null}

      <section className="mb-8 flex flex-col gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Start a new quiz
        </h2>
        {subjects === null ? (
          <div className="h-24 animate-pulse rounded-[14px] bg-surface-2/60" />
        ) : eligibleSubjects.length === 0 ? (
          <NoEligibleSubjects hasAny={(subjects?.length ?? 0) > 0} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {eligibleSubjects.map((s) => (
              <SubjectRow
                key={s.id}
                subject={s}
                generating={generatingFor === s.id}
                disabled={generatingFor !== null && generatingFor !== s.id}
                onGenerate={() => handleGenerate(s)}
              />
            ))}
          </div>
        )}
      </section>

      {stats && stats.recent.length > 0 ? (
        <RecentAttempts stats={stats} refresh={refreshStats} />
      ) : null}
    </div>
  );
}

function StatsRow({ stats }: { stats: PracticeStats | null }) {
  if (!stats) {
    return (
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[14px] bg-surface-2/60" />
        ))}
      </div>
    );
  }
  const acc = Math.round(stats.overall.accuracy * 100);
  return (
    <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
      <StatTile
        label="Quizzes taken"
        value={String(stats.overall.totalAttempts)}
        icon={<Target className="h-4 w-4" strokeWidth={1.75} />}
      />
      <StatTile
        label="Accuracy"
        value={stats.overall.scoreMax > 0 ? `${acc}%` : "—"}
        icon={<TrendingUp className="h-4 w-4" strokeWidth={1.75} />}
        accent
      />
      <StatTile
        label="Correct / total"
        value={`${stats.overall.scoreTotal} / ${stats.overall.scoreMax}`}
        icon={<HelpCircle className="h-4 w-4" strokeWidth={1.75} />}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`glow-card border border-default bg-surface p-4 ${accent ? "border-l-[3px] border-l-[var(--accent)]" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-ink-faint">
        <span className="text-[10.5px] font-bold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <p
        className={`tabular text-[1.6rem] leading-tight ${accent ? "text-[color:var(--accent-deep)]" : "text-ink"}`}
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {value}
      </p>
    </div>
  );
}

function ImprovementSection({ stats }: { stats: PracticeStats }) {
  return (
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        Where to focus next
      </h2>
      <div className="glow-card border border-default bg-surface p-4">
        <ul className="flex flex-col divide-y divide-[color:var(--border)]/60">
          {stats.weakest.map((t) => {
            const pct = Math.round(t.accuracy * 100);
            return (
              <li key={t.topic} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{t.topic}</p>
                  <p className="tabular text-[12px] text-ink-faint">
                    {t.correct} of {t.total} correct
                  </p>
                </div>
                <Badge tone={pct < 50 ? "danger" : pct < 75 ? "warning" : "neutral"}>
                  {pct}%
                </Badge>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[12px] text-ink-faint">
          Suggestion: re-read these sections in the relevant cheat sheet or open the study guide for that subject.
        </p>
      </div>
    </section>
  );
}

function NoEligibleSubjects({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="glow-card flex flex-col items-center gap-3 border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
        style={{ background: "var(--surface)", color: "var(--accent-deep)" }}
      >
        <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3
        className="text-[1.2rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {hasAny ? "No cheat sheets ready" : "No subjects yet"}
      </h3>
      <p className="max-w-md text-sm text-ink-muted">
        {hasAny
          ? "Practice questions are pulled from a subject's cheat sheet. Generate a cheat sheet first, then come back."
          : "Add a subject and upload some notes — quizzes come from the cheat sheet."}
      </p>
      <Button asChild>
        <Link href={hasAny ? "/" : "/subjects/new"}>
          {hasAny ? "Pick a subject" : "Add a subject"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
    </div>
  );
}

function SubjectRow({
  subject,
  generating,
  disabled,
  onGenerate,
}: {
  subject: Subject;
  generating: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
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
        <p className="mt-0.5 text-[12px] text-ink-faint">Cheat sheet ready</p>
      </div>
      <Button onClick={onGenerate} disabled={generating || disabled} size="sm">
        {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {generating ? "Generating…" : "Generate"}
      </Button>
    </div>
  );
}

function RecentAttempts({
  stats,
  refresh,
}: {
  stats: PracticeStats;
  refresh: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Recent attempts
        </h2>
        <button
          type="button"
          onClick={refresh}
          className="text-[11px] font-semibold text-ink-faint hover:text-ink"
        >
          Refresh
        </button>
      </div>
      <div className="glow-card border border-default bg-surface">
        <ul className="flex flex-col divide-y divide-[color:var(--border)]/60">
          {stats.recent.map((a) => {
            const pct = a.scoreMax > 0 ? Math.round((a.scoreTotal / a.scoreMax) * 100) : 0;
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold leading-tight text-ink">
                    {a.subjectName ?? a.quizTitle}
                  </p>
                  <p className="tabular text-[11.5px] text-ink-faint">
                    {formatRelativeTime(a.completedAt)}
                  </p>
                </div>
                <Badge tone={pct >= 80 ? "success" : pct >= 60 ? "accent" : "warning"}>
                  {a.scoreTotal} / {a.scoreMax} · {pct}%
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
