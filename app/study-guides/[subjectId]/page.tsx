"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCcw,
  Sparkles,
  AlertCircle,
  KeyRound,
  Printer,
  BookText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheatsheetView } from "@/components/cheatsheet-view";
import { generate } from "@/lib/gemini-client";
import { getSettings } from "@/lib/store";
import { useSubject, updateSubject } from "@/lib/cloud-subjects";

type GenState =
  | { kind: "idle" }
  | { kind: "loading"; partial: string }
  | { kind: "done"; markdown: string }
  | { kind: "error"; code: string; message: string };

export default function StudyGuidePage() {
  const params = useParams<{ subjectId: string }>();
  const id = params.subjectId;

  const { subject, error, setSubject } = useSubject(id);

  const [hasKey, setHasKey] = React.useState(false);
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [state, setState] = React.useState<GenState>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const key = getSettings().geminiKey;
    setHasKey(!!key);
    setApiKey(key ?? null);
  }, []);

  // Sync existing guide from DB into local view state.
  React.useEffect(() => {
    if (subject && subject.studyGuideMarkdown && state.kind === "idle") {
      setState({ kind: "done", markdown: subject.studyGuideMarkdown });
    }
  }, [subject, state.kind]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const start = React.useCallback(async () => {
    if (!subject) return;
    const key = getSettings().geminiKey;
    if (!key) {
      setState({
        kind: "error",
        code: "missing_key",
        message: "Add your Gemini API key in Settings to generate a study guide.",
      });
      return;
    }
    if (subject.files.length === 0) {
      setState({
        kind: "error",
        code: "no_files",
        message: "Add at least one file to this subject before generating a study guide.",
      });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ kind: "loading", partial: "" });

    await generate(
      { apiKey: key, subject, mode: "studyguide" },
      {
        signal: ac.signal,
        onDelta: (text) => {
          setState((prev) =>
            prev.kind === "loading"
              ? { kind: "loading", partial: prev.partial + text }
              : prev,
          );
        },
        onDone: async (full) => {
          setState({ kind: "done", markdown: full });
          try {
            const updated = await updateSubject(subject.id, { studyGuideMarkdown: full });
            setSubject({ ...subject, ...updated, files: subject.files });
          } catch (err) {
            console.error("Failed to persist study guide:", err);
          }
        },
        onError: (message, code = "unknown") => {
          setState({ kind: "error", code, message });
        },
      },
    );
  }, [subject, setSubject]);

  if (subject === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="skeleton h-32 rounded-[18px]" />
      </div>
    );
  }
  if (subject === null) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold text-ink">Subject not found</h1>
        <p className="mb-6 text-ink-muted">{error ?? "It may have been deleted."}</p>
        <Button asChild>
          <Link href="/study-guides">Back to guides</Link>
        </Button>
      </div>
    );
  }

  const hasFiles = subject.files.length > 0;
  const hasGuide = !!subject.studyGuideMarkdown || state.kind === "done";

  const displayed =
    state.kind === "done"
      ? state.markdown
      : state.kind === "loading"
        ? state.partial
        : subject.studyGuideMarkdown ?? "";

  return (
    <div className="animate-fade-up mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
        <Link
          href="/study-guides"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to guides
        </Link>

        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Study guide
            </p>
            <h1
              className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {subject.name}
            </h1>
            {subject.studyGuideGeneratedAt ? (
              <p className="text-[12px] text-ink-faint">
                Last generated{" "}
                <span className="tabular">
                  {new Date(subject.studyGuideGeneratedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={start}
              disabled={state.kind === "loading" || !hasFiles || !hasKey}
              variant={hasGuide ? "secondary" : "primary"}
              title={!hasFiles ? "Add at least one file first" : undefined}
            >
              <RefreshCcw className={state.kind === "loading" ? "animate-spin" : undefined} />
              {state.kind === "loading"
                ? "Generating…"
                : hasGuide
                  ? "Regenerate"
                  : "Generate study guide"}
            </Button>
            {hasGuide ? (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            ) : null}
          </div>
        </header>

        {!hasKey ? (
          <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-default bg-surface-2/60 p-4 text-sm text-ink-muted">
            <KeyRound className="mt-0.5 h-5 w-5 text-[color:var(--accent)]" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="font-semibold text-ink">No API key yet</p>
              <p className="mt-0.5">
                PufferStudy needs your free Google Gemini key to generate the guide.{" "}
                <Link href="/settings" className="text-[color:var(--accent)] underline-offset-4 hover:underline">
                  Add it in Settings →
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
            <div className="flex-1 text-ink">
              <p className="font-semibold">{state.message}</p>
              {state.code === "invalid_key" ? (
                <p className="mt-1 text-ink-muted">
                  <Link href="/settings" className="text-[color:var(--accent)] underline-offset-4 hover:underline">
                    Update your key in Settings →
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {state.kind === "loading" ? (
        <CheatsheetView
          markdown={state.partial || "_Building your study guide…_"}
          className="opacity-95"
        />
      ) : hasGuide ? (
        <CheatsheetView markdown={displayed} />
      ) : (
        <div className="no-print glow-card flex flex-col items-center gap-4 border border-default border-dashed bg-surface-2/40 px-6 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-default"
            style={{ background: "var(--surface)", color: "var(--accent-deep)" }}
          >
            <BookText className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <h2
            className="text-[1.4rem] leading-tight"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            {hasFiles ? "Ready to generate" : "Upload your notes first"}
          </h2>
          <p className="max-w-md text-sm text-ink-muted">
            {hasFiles
              ? `Turn ${subject.files.length} ${subject.files.length === 1 ? "file" : "files"} into a long-form study guide — concepts explained with examples and common pitfalls.${subject.cheatsheetMarkdown ? " Uses your cheat sheet as additional structure." : ""}`
              : "Snap a photo of your notes, drop in a PDF, or upload a packet. Once you have at least one file, you can generate the guide."}
          </p>
          {hasFiles ? (
            <Button onClick={start} size="lg" disabled={!hasKey}>
              <Sparkles />
              Generate study guide
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href={`/subjects/${subject.id}`}>
                Open subject to upload files
                <ArrowLeft className="h-4 w-4 rotate-180" strokeWidth={1.75} />
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
