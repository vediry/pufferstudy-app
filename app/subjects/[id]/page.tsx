"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  RefreshCcw,
  Sparkles,
  Trash2,
  AlertCircle,
  KeyRound,
  ChevronDown,
  Layers,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheatsheetView } from "@/components/cheatsheet-view";
import { CheatsheetChat } from "@/components/cheatsheet-chat";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGridItem } from "@/components/image-grid-item";
import { generate } from "@/lib/gemini-client";
import { getSettings } from "@/lib/store";
import {
  useSubject,
  deleteSubject,
  deleteFile,
  updateFileCaption,
  updateSubject,
  type SubjectFile,
} from "@/lib/cloud-subjects";
import { generateDeck, fetchDecks } from "@/lib/cloud-flashcards";
import { countdownLabel, countdownTone, daysUntil } from "@/lib/utils";

type GenState =
  | { kind: "idle" }
  | { kind: "loading"; partial: string }
  | { kind: "done"; markdown: string }
  | { kind: "error"; code: string; message: string };

export default function SubjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { subject, error, refresh, setSubject } = useSubject(id);

  // Generation state (mirrors /cheatsheet's old GenState).
  const [hasKey, setHasKey] = React.useState<boolean>(false);
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [state, setState] = React.useState<GenState>({ kind: "idle" });
  // Files panel: null = not initialized yet (waiting for subject load).
  // Once we know whether a cheatsheet exists, default to collapsed if it does
  // (chat = focus) or expanded if it doesn't (user needs to upload).
  const [filesOpen, setFilesOpen] = React.useState<boolean | null>(null);
  // Flashcards: existing deck id for this subject (if any), and generation state.
  const [deckId, setDeckId] = React.useState<string | null>(null);
  const [flashcardsGenerating, setFlashcardsGenerating] = React.useState(false);
  const [flashcardsError, setFlashcardsError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (subject && filesOpen === null) {
      setFilesOpen(!subject.cheatsheetMarkdown);
    }
  }, [subject, filesOpen]);

  React.useEffect(() => {
    const key = getSettings().geminiKey;
    setHasKey(!!key);
    setApiKey(key ?? null);
  }, []);

  // Sync cheatsheet from DB into local view state.
  React.useEffect(() => {
    if (subject && subject.cheatsheetMarkdown && state.kind === "idle") {
      setState({ kind: "done", markdown: subject.cheatsheetMarkdown });
    }
  }, [subject, state.kind]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  // Look up whether this subject already has a flashcard deck so we can show
  // "Study flashcards" vs "Generate flashcards" accordingly.
  React.useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    (async () => {
      try {
        const decks = await fetchDecks();
        if (cancelled) return;
        const match = decks.find((d) => d.subjectId === subject.id);
        setDeckId(match?.id ?? null);
      } catch {
        // Non-fatal — deck list is best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subject]);

  async function onGenerateFlashcards() {
    if (!subject) return;
    const key = getSettings().geminiKey;
    if (!key) {
      setFlashcardsError("Add your Gemini API key in Settings to generate flashcards.");
      return;
    }
    setFlashcardsError(null);
    setFlashcardsGenerating(true);
    try {
      const { deck } = await generateDeck(subject.id, key);
      setDeckId(deck.id);
      router.push(`/flashcards/${deck.id}`);
    } catch (err) {
      setFlashcardsError(err instanceof Error ? err.message : "Couldn't generate flashcards.");
    } finally {
      setFlashcardsGenerating(false);
    }
  }

  function onUploaded(newFiles: SubjectFile[]) {
    if (!subject) return;
    setSubject({ ...subject, files: [...subject.files, ...newFiles] });
  }

  async function onCaption(file: SubjectFile, caption: string) {
    if (!subject) return;
    setSubject({
      ...subject,
      files: subject.files.map((f) => (f.id === file.id ? { ...f, caption } : f)),
    });
    try {
      await updateFileCaption(subject.id, file.id, caption);
    } catch {
      refresh();
    }
  }

  async function onDeleteFile(file: SubjectFile) {
    if (!subject) return;
    const previous = subject.files;
    setSubject({ ...subject, files: subject.files.filter((f) => f.id !== file.id) });
    try {
      await deleteFile(subject.id, file.id);
    } catch {
      setSubject({ ...subject, files: previous });
    }
  }

  async function onDeleteSubject() {
    if (!subject) return;
    if (!window.confirm(`Delete "${subject.name}" and its files?`)) return;
    try {
      await deleteSubject(subject.id);
      router.push("/");
    } catch (err) {
      console.error(err);
    }
  }

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
    if (subject.files.length === 0) {
      setState({
        kind: "error",
        code: "no_files",
        message: "Add at least one file to this subject first.",
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
            prev.kind === "loading"
              ? { kind: "loading", partial: prev.partial + text }
              : prev,
          );
        },
        onDone: async (full) => {
          setState({ kind: "done", markdown: full });
          try {
            const updated = await updateSubject(subject.id, {
              cheatsheetMarkdown: full,
            });
            setSubject({ ...subject, ...updated, files: subject.files });
          } catch (err) {
            console.error("Failed to persist cheatsheet:", err);
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
        <div className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
      </div>
    );
  }
  if (subject === null) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold text-ink">Subject not found</h1>
        <p className="mb-6 text-ink-muted">{error ?? "It may have been deleted."}</p>
        <Button asChild>
          <Link href="/">Back to subjects</Link>
        </Button>
      </div>
    );
  }

  const days = daysUntil(subject.testDate);
  const tone = countdownTone(days);
  const label = countdownLabel(days);
  const hasFiles = subject.files.length > 0;
  const hasCheatsheet = !!subject.cheatsheetMarkdown || state.kind === "done";

  const displayedSheet =
    state.kind === "done"
      ? state.markdown
      : state.kind === "loading"
        ? state.partial
        : subject?.cheatsheetMarkdown ?? "";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to subjects
        </Link>

        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Badge tone={tone}>{label}</Badge>
            <h1
              className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {subject.name}
            </h1>
            {subject.testLabel ? (
              <p className="text-[15px] text-ink-muted">{subject.testLabel}</p>
            ) : null}
            {subject.cheatsheetGeneratedAt ? (
              <p className="text-[12px] text-ink-faint">
                Cheat sheet last generated{" "}
                <span className="tabular">
                  {new Date(subject.cheatsheetGeneratedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={start}
              disabled={state.kind === "loading" || !hasFiles || !hasKey}
              variant={hasCheatsheet ? "secondary" : "primary"}
              title={!hasFiles ? "Add at least one file first" : undefined}
            >
              <RefreshCcw className={state.kind === "loading" ? "animate-spin" : undefined} />
              {state.kind === "loading"
                ? "Generating…"
                : hasCheatsheet
                  ? "Regenerate"
                  : "Generate cheat sheet"}
            </Button>
            {hasCheatsheet ? (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            ) : null}
            {hasCheatsheet ? (
              deckId ? (
                <Button variant="secondary" asChild>
                  <Link href={`/flashcards/${deckId}`}>
                    <Layers />
                    Study flashcards
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={onGenerateFlashcards}
                  disabled={flashcardsGenerating || !hasKey}
                  title={!hasKey ? "Add your Gemini key in Settings first" : undefined}
                >
                  {flashcardsGenerating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Layers />
                  )}
                  {flashcardsGenerating ? "Generating…" : "Generate flashcards"}
                </Button>
              )
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteSubject}
              aria-label="Delete subject"
            >
              <Trash2 />
            </Button>
          </div>
        </header>

        {flashcardsError ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
            <p className="flex-1 text-ink">{flashcardsError}</p>
          </div>
        ) : null}

        {!hasKey ? (
          <div className="mb-6 flex items-start gap-3 rounded-[14px] border border-default bg-surface-2/60 p-4 text-sm text-ink-muted">
            <KeyRound className="mt-0.5 h-5 w-5 text-[color:var(--accent)]" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="font-semibold text-ink">No API key yet</p>
              <p className="mt-0.5">
                PufferStudy needs your free Google Gemini key to generate the sheet. The key stays in your browser.{" "}
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main: cheatsheet view OR empty/initial state */}
        <div className="min-w-0 flex-[3]">
          {state.kind === "loading" ? (
            <CheatsheetView
              markdown={state.partial || "_Reading your notes…_"}
              className="opacity-95"
            />
          ) : hasCheatsheet ? (
            <CheatsheetView markdown={displayedSheet} />
          ) : (
            <div className="no-print glow-card flex flex-col items-center gap-4 border border-default border-dashed bg-surface-2/40 px-6 py-16 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-default"
                style={{ background: "var(--surface)", color: "var(--accent-deep)" }}
              >
                <Sparkles className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h2
                className="text-[1.4rem] leading-tight"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
              >
                {hasFiles ? "Ready to generate" : "Upload your notes first"}
              </h2>
              <p className="max-w-md text-sm text-ink-muted">
                {hasFiles
                  ? `Turn ${subject.files.length} ${subject.files.length === 1 ? "file" : "files"} into a printable cheat sheet — then refine it with the chat on the side.`
                  : "Snap a photo of your notes, drop in a PDF, or upload a packet. Once you have at least one file, you can generate a cheat sheet."}
              </p>
              {hasFiles ? (
                <Button onClick={start} size="lg" disabled={!hasKey}>
                  <Sparkles />
                  Generate cheat sheet
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Side: files panel + chat panel */}
        <aside className="no-print flex w-full min-w-0 flex-col gap-4 lg:w-[420px] lg:shrink-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {/* Files — collapsible to keep chat in view */}
          <section className="glow-card flex flex-col border border-default bg-surface">
            <button
              type="button"
              onClick={() => setFilesOpen((v) => !v)}
              aria-expanded={filesOpen === true}
              className="glow-on-hover flex items-center justify-between rounded-[14px] px-4 py-3 text-left"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Files {hasFiles ? `(${subject.files.length})` : ""}
              </p>
              <ChevronDown
                className={`h-4 w-4 text-ink-muted transition-transform ${
                  filesOpen ? "" : "-rotate-90"
                }`}
                strokeWidth={2}
              />
            </button>
            {filesOpen ? (
              <div className="flex flex-col gap-3 border-t border-default px-4 pb-4 pt-3">
                <ImageUploader subjectId={subject.id} onUploaded={onUploaded} />
                {hasFiles ? (
                  <div className="grid grid-cols-1 gap-3">
                    {subject.files.map((file) => (
                      <ImageGridItem
                        key={file.id}
                        file={file}
                        onCaptionChange={(next) => onCaption(file, next)}
                        onDelete={() => onDeleteFile(file)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Chat — only renders once a sheet exists so refine has something to act on */}
          {hasCheatsheet && displayedSheet.length > 0 ? (
            <section className="glow-card flex flex-col gap-3 border border-default bg-surface p-4">
              <header className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Chat with this sheet
                </p>
              </header>
              <CheatsheetChat
                subjectId={subject.id}
                subjectName={subject.name}
                apiKey={apiKey}
                currentSheet={displayedSheet}
                messages={subject.chatMessages}
                onTurnComplete={async ({ nextMessages, nextSheet }) => {
                  const optimistic = {
                    ...subject,
                    chatMessages: nextMessages,
                    ...(nextSheet !== null ? { cheatsheetMarkdown: nextSheet } : {}),
                  };
                  setSubject(optimistic);
                  if (nextSheet !== null) {
                    setState({ kind: "done", markdown: nextSheet });
                  }
                  try {
                    const updated = await updateSubject(subject.id, {
                      chatMessages: nextMessages,
                      ...(nextSheet !== null ? { cheatsheetMarkdown: nextSheet } : {}),
                    });
                    setSubject({
                      ...subject,
                      ...updated,
                      files: subject.files,
                      chatMessages: nextMessages,
                    });
                  } catch (err) {
                    console.error("Failed to persist chat turn:", err);
                  }
                }}
              />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
