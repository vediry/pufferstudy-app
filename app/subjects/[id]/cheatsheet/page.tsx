"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, FileDown, RefreshCcw, AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheatsheetView } from "@/components/cheatsheet-view";
import { generate } from "@/lib/gemini-client";
import { getSettings, getSubject, upsertSubject } from "@/lib/store";
import type { Subject } from "@/types";

type GenState =
  | { kind: "idle" }
  | { kind: "loading"; partial: string }
  | { kind: "done"; markdown: string }
  | { kind: "error"; code: string; message: string };

export default function CheatsheetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [subject, setSubject] = React.useState<Subject | null | undefined>(undefined);
  const [hasKey, setHasKey] = React.useState<boolean>(false);
  const [state, setState] = React.useState<GenState>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!id) return;
    const subj = getSubject(id);
    setSubject(subj);
    setHasKey(!!getSettings().geminiKey);
    if (subj?.cheatSheet) {
      setState({ kind: "done", markdown: subj.cheatSheet.markdown });
    }
  }, [id]);

  const start = React.useCallback(async () => {
    if (!subject) return;
    const key = getSettings().geminiKey;
    if (!key) {
      setState({
        kind: "error",
        code: "missing_key",
        message: "Add your Gemini API key in Settings to generate a cheat sheet.",
      });
      return;
    }
    if (subject.imageIds.length === 0) {
      setState({
        kind: "error",
        code: "no_images",
        message: "Add at least one photo to this subject first.",
      });
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ kind: "loading", partial: "" });
    await generate(
      { apiKey: key, subject, mode: "cheatsheet" },
      {
        signal: ac.signal,
        onDelta: (text) => {
          setState((prev) =>
            prev.kind === "loading" ? { kind: "loading", partial: prev.partial + text } : prev,
          );
        },
        onDone: (full) => {
          setState({ kind: "done", markdown: full });
          const next: Subject = {
            ...subject,
            cheatSheet: { markdown: full, generatedAt: new Date().toISOString() },
          };
          setSubject(next);
          upsertSubject(next);
        },
        onError: (message, code = "unknown") => {
          setState({ kind: "error", code, message });
        },
      },
    );
  }, [subject]);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (subject === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-surface-2/60" />
      </div>
    );
  }
  if (subject === null) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold">Subject not found</h1>
        <Button asChild>
          <Link href="/">Back to subjects</Link>
        </Button>
      </div>
    );
  }

  const showInitialCTA = state.kind === "idle";

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
        <Link
          href={`/subjects/${subject.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to {subject.name}
        </Link>

        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink-faint">Cheat sheet</p>
            <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight sm:text-[2.25rem]">
              {subject.name}
            </h1>
            {subject.cheatSheet ? (
              <p className="text-[13px] text-ink-faint">
                Last generated{" "}
                <span className="tabular">
                  {new Date(subject.cheatSheet.generatedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={start}
              disabled={state.kind === "loading"}
              variant={state.kind === "done" ? "secondary" : "primary"}
            >
              <RefreshCcw className={state.kind === "loading" ? "animate-spin" : undefined} />
              {state.kind === "loading"
                ? "Generating…"
                : state.kind === "done" || subject.cheatSheet
                  ? "Regenerate"
                  : "Generate"}
            </Button>
            {state.kind === "done" ? (
              <>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer />
                  Print
                </Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  <FileDown />
                  Save as PDF
                </Button>
              </>
            ) : null}
          </div>
        </header>

        {!hasKey ? (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-default bg-surface-2/60 p-4 text-sm text-ink-muted">
            <KeyRound className="mt-0.5 h-5 w-5 text-[var(--primary)]" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="font-medium text-ink">No API key yet</p>
              <p className="mt-0.5">
                PufferStudy needs your free Google Gemini key to generate the sheet. The key stays in your browser.{" "}
                <Link href="/settings" className="text-[var(--primary)] underline-offset-4 hover:underline">
                  Add it in Settings →
                </Link>
              </p>
            </div>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--danger)]" strokeWidth={1.75} />
            <div className="flex-1 text-ink">
              <p className="font-medium">{state.message}</p>
              {state.code === "invalid_key" ? (
                <p className="mt-1 text-ink-muted">
                  <Link href="/settings" className="text-[var(--primary)] underline-offset-4 hover:underline">
                    Update your key in Settings →
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showInitialCTA ? (
        <div className="no-print rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
          <p className="mb-6 text-[15px] text-ink-muted">
            Ready to turn {subject.imageIds.length}{" "}
            {subject.imageIds.length === 1 ? "photo" : "photos"} into a printable cheat sheet?
          </p>
          <Button onClick={start} size="lg" disabled={!hasKey}>
            <RefreshCcw />
            Generate cheat sheet
          </Button>
        </div>
      ) : state.kind === "loading" ? (
        <CheatsheetView
          markdown={state.partial || "_Reading your notes…_"}
          className="opacity-95"
        />
      ) : state.kind === "done" ? (
        <CheatsheetView markdown={state.markdown} />
      ) : (
        // error state — show the previous saved sheet if any
        subject.cheatSheet ? (
          <CheatsheetView markdown={subject.cheatSheet.markdown} />
        ) : null
      )}
    </div>
  );
}
