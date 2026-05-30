"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Puffer } from "@/components/puffer";
import { getSettings } from "@/lib/store";
import {
  fetchQuiz,
  submitAttempt,
  type QuizForUser,
  type FeedbackItem,
  type AttemptResult,
} from "@/lib/cloud-practice";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; quiz: QuizForUser };

type Mode =
  | { kind: "taking"; index: number }
  | { kind: "grading" }
  | { kind: "done"; attempt: AttemptResult; feedback: FeedbackItem[] };

export default function QuizPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [load, setLoad] = React.useState<LoadState>({ kind: "loading" });
  const [answers, setAnswers] = React.useState<Record<number, string>>({});
  const [mode, setMode] = React.useState<Mode>({ kind: "taking", index: 0 });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const quiz = await fetchQuiz(quizId);
        if (cancelled) return;
        if (!quiz) {
          setLoad({ kind: "missing" });
          return;
        }
        setLoad({ kind: "ready", quiz });
      } catch {
        setLoad({ kind: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  if (load.kind === "loading") {
    return (
      <div className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="h-64 animate-pulse rounded-[14px] bg-surface-2/60" />
      </div>
    );
  }
  if (load.kind === "missing") {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold text-ink">Quiz not found</h1>
        <Button asChild>
          <Link href="/practice">Back to practice</Link>
        </Button>
      </div>
    );
  }

  const quiz = load.quiz;
  const total = quiz.questions.length;

  async function handleSubmit() {
    const apiKey = getSettings().geminiKey;
    if (!apiKey) {
      setError("Add your Gemini API key in Settings to grade the quiz.");
      return;
    }
    setError(null);
    setMode({ kind: "grading" });
    const responses = quiz.questions.map((_, i) => ({
      index: i,
      userAnswer: answers[i] ?? "",
    }));
    try {
      const result = await submitAttempt(quizId, apiKey, responses);
      setMode({ kind: "done", attempt: result.attempt, feedback: result.feedback });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grade the quiz.");
      setMode({ kind: "taking", index: total - 1 });
    }
  }

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }

  function next() {
    if (mode.kind !== "taking") return;
    const i = mode.index;
    if (i + 1 < total) {
      setMode({ kind: "taking", index: i + 1 });
    } else {
      void handleSubmit();
    }
  }

  function prev() {
    if (mode.kind !== "taking") return;
    if (mode.index > 0) setMode({ kind: "taking", index: mode.index - 1 });
  }

  function restart() {
    setAnswers({});
    setMode({ kind: "taking", index: 0 });
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/practice"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to practice
      </Link>

      <header className="mb-6 flex flex-col gap-2">
        <Badge tone="accent" className="self-start">
          <Sparkles className="mr-1 h-3 w-3" strokeWidth={2} />
          Practice quiz
        </Badge>
        <h1
          className="text-[1.8rem] leading-tight tracking-tight text-ink sm:text-[2.2rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {quiz.title}
        </h1>
      </header>

      {error ? (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
          <p className="flex-1 text-ink">{error}</p>
        </div>
      ) : null}

      {mode.kind === "taking" ? (
        <Taking
          quiz={quiz}
          index={mode.index}
          total={total}
          answer={answers[mode.index] ?? ""}
          onAnswer={(v) => setAnswer(mode.index, v)}
          onPrev={prev}
          onNext={next}
        />
      ) : mode.kind === "grading" ? (
        <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--accent)]" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">Grading your answers…</p>
        </div>
      ) : (
        <Results
          quiz={quiz}
          feedback={mode.feedback}
          attempt={mode.attempt}
          onRestart={restart}
        />
      )}
    </div>
  );
}

function Taking({
  quiz,
  index,
  total,
  answer,
  onAnswer,
  onPrev,
  onNext,
}: {
  quiz: QuizForUser;
  index: number;
  total: number;
  answer: string;
  onAnswer: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const q = quiz.questions[index];
  const isLast = index === total - 1;
  const hasAnswer = answer.trim().length > 0;
  const nextLabel = isLast ? "Submit" : hasAnswer ? "Next" : "Skip";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        <span>Question {index + 1} of {total}</span>
        <span>Topic · {q.topic}</span>
      </div>

      <div className="glow-card border border-default bg-surface p-6">
        <p
          className="mb-5 text-[1.2rem] leading-snug text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {q.prompt}
        </p>

        {q.kind === "multiple_choice" ? (
          <fieldset className="flex flex-col gap-2">
            {q.choices.map((choice, i) => {
              const selected = answer === String(i);
              return (
                <label
                  key={i}
                  className={`glow-on-hover flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-sm transition-colors ${
                    selected
                      ? "border-[color:var(--accent)] bg-surface-2"
                      : "border-default bg-surface hover:bg-surface-2/60"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${index}`}
                    value={String(i)}
                    checked={selected}
                    onChange={(e) => onAnswer(e.target.value)}
                    className="sr-only"
                  />
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                        : "border-default bg-transparent"
                    }`}
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-[color:var(--primary-foreground)]" />
                    ) : null}
                  </span>
                  <span className="flex-1 text-ink">{choice}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <textarea
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            className="w-full resize-none rounded-[10px] border border-default bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onPrev} disabled={index === 0}>
          <ArrowLeft />
          Previous
        </Button>
        <Button
          onClick={onNext}
          variant={hasAnswer || isLast ? "primary" : "secondary"}
          title={!hasAnswer && !isLast ? "Skipped questions are marked wrong on submit" : undefined}
        >
          {nextLabel}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function Results({
  quiz,
  feedback,
  attempt,
  onRestart,
}: {
  quiz: QuizForUser;
  feedback: FeedbackItem[];
  attempt: AttemptResult;
  onRestart: () => void;
}) {
  const pct = attempt.scoreMax > 0 ? Math.round((attempt.scoreTotal / attempt.scoreMax) * 100) : 0;
  const tone = pct >= 80 ? "success" : pct >= 60 ? "accent" : pct >= 40 ? "warning" : "danger";

  // Sort topics worst-first to highlight what to review.
  const topicEntries = Object.entries(attempt.topicAcc).sort(
    (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-10 text-center">
        <Puffer size={112} mood="happy" />
        <h2
          className="text-[1.6rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {attempt.scoreTotal} / {attempt.scoreMax}
        </h2>
        <Badge tone={tone}>{pct}% correct</Badge>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw />
            Try again
          </Button>
          <Button asChild>
            <Link href="/practice">
              <Check />
              Done
            </Link>
          </Button>
        </div>
      </div>

      {topicEntries.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Topic breakdown
          </h3>
          <div className="glow-card border border-default bg-surface p-4">
            <ul className="flex flex-col divide-y divide-[color:var(--border)]/60">
              {topicEntries.map(([topic, acc]) => {
                const tpct = Math.round((acc.correct / acc.total) * 100);
                return (
                  <li
                    key={topic}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="text-[14px] font-semibold text-ink">{topic}</span>
                    <Badge tone={tpct < 50 ? "danger" : tpct < 75 ? "warning" : "success"}>
                      {acc.correct}/{acc.total} · {tpct}%
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Question-by-question
        </h3>
        <div className="flex flex-col gap-3">
          {feedback.map((f) => (
            <FeedbackRow key={f.index} feedback={f} quiz={quiz} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FeedbackRow({
  feedback,
  quiz,
}: {
  feedback: FeedbackItem;
  quiz: QuizForUser;
}) {
  const q = quiz.questions[feedback.index];
  const ok = feedback.isCorrect;
  return (
    <article
      className={`glow-card flex flex-col gap-2 border bg-surface p-4 ${
        ok ? "border-default" : "border-[color:var(--danger)]/40"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Q{feedback.index + 1} · {q.topic}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
            ok
              ? "border-[color:var(--success,var(--accent))] text-[color:var(--success,var(--accent))]"
              : "border-[color:var(--danger)] text-[color:var(--danger)]"
          }`}
        >
          {ok ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
          {ok ? "Correct" : "Wrong"}
        </span>
      </header>
      <p className="text-[14px] font-semibold text-ink">{q.prompt}</p>
      {feedback.kind === "multiple_choice" ? (
        <div className="text-[13px] text-ink-muted">
          <p>
            Your answer:{" "}
            <span className={ok ? "text-ink" : "text-[color:var(--danger)]"}>
              {(() => {
                const idx = Number.parseInt(feedback.userAnswer, 10);
                if (!Number.isFinite(idx)) return "(no answer)";
                const choice = q.kind === "multiple_choice" ? q.choices[idx] : undefined;
                return choice ?? "(no answer)";
              })()}
            </span>
          </p>
          {!ok ? (
            <p className="mt-1">
              Correct: <span className="text-ink">{feedback.correctChoice}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="text-[13px] text-ink-muted">
          <p>
            Your answer:{" "}
            <span className={ok ? "text-ink" : "text-[color:var(--danger)]"}>
              {feedback.userAnswer.trim() || "(blank)"}
            </span>
          </p>
          <p className="mt-1">
            Expected: <span className="text-ink">{feedback.expectedAnswer}</span>
          </p>
        </div>
      )}
    </article>
  );
}
