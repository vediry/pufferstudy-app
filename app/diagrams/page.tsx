"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Network, Sparkles } from "lucide-react";
import { getSettings } from "@/lib/store";
import { useSubjects, type Subject } from "@/lib/cloud-subjects";
import { Puffer } from "@/components/puffer";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { Button } from "@/components/ui/button";
import {
  DIAGRAM_TYPES,
  type DiagramType,
  type DiagramResult,
} from "@/lib/diagram";

const TYPE_LABELS: Record<DiagramType, string> = {
  mindmap: "Mindmap",
  flowchart: "Flowchart",
  timeline: "Timeline",
  graph: "Map",
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

function materialsFor(s: Subject | undefined): string {
  if (!s) return "";
  return [s.cheatsheetMarkdown, s.studyGuideMarkdown]
    .filter((m): m is string => !!m && m.trim().length > 0)
    .join("\n\n");
}

export default function DiagramsPage() {
  const { subjects } = useSubjects();
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [topic, setTopic] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [result, setResult] = React.useState<DiagramResult | null>(null);

  React.useEffect(() => {
    setApiKey(getSettings().geminiKey);
  }, []);

  const hasKey = !!apiKey;
  const loading = status.kind === "loading";
  const active = (subjects ?? []).filter((s) => !s.archived);
  const selected = active.find((s) => s.id === subjectId);
  const materials = materialsFor(selected);
  const canGenerate = hasKey && (!!topic.trim() || (!!selected && !!materials));

  const generate = React.useCallback(
    async (forceType?: DiagramType) => {
      if (!apiKey || loading) return;
      const body = {
        apiKey,
        subjectName: selected?.name,
        materials: materials || undefined,
        topic: topic.trim() || undefined,
        forceType,
      };
      setStatus({ kind: "loading" });
      try {
        const res = await fetch("/api/diagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as
          | (DiagramResult & { error?: undefined })
          | { error: string }
          | null;
        if (!res.ok || !data || "error" in data) {
          setStatus({
            kind: "error",
            message:
              (data && "error" in data && data.error) ||
              "Something went wrong. Try again.",
          });
          return;
        }
        setResult(data);
        setStatus({ kind: "idle" });
      } catch {
        setStatus({ kind: "error", message: "Couldn't reach the server." });
      }
    },
    [apiKey, loading, selected, materials, topic],
  );

  return (
    <div className="mx-auto flex max-w-[820px] flex-col px-4 py-8 pb-24">
      <header className="mb-5 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <Network className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-ink">Diagrams</h1>
          <p className="text-[13px] text-ink-muted">
            Map out any subject or topic — a mindmap, flowchart, timeline, or
            relationship map you can read at a glance.
          </p>
        </div>
      </header>

      {!hasKey ? (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--warn)]" strokeWidth={1.75} />
          <p className="text-ink-muted">
            Add your Gemini API key in{" "}
            <Link href="/settings" className="font-semibold text-ink underline">
              Settings
            </Link>{" "}
            to make diagrams.
          </p>
        </div>
      ) : null}

      {/* Controls */}
      <div className="glow-card flex flex-col gap-3 border border-default bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="diagram-subject" className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Subject
          </label>
          <select
            id="diagram-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-[10px] border border-default bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="">No subject — freeform</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="diagram-topic" className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Topic {selected && materials ? "(optional — blank = overview)" : ""}
          </label>
          <input
            id="diagram-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canGenerate && !loading) void generate();
            }}
            placeholder='e.g. "the causes of World War 1"'
            className="rounded-[10px] border border-default bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            {!hasKey
              ? "Add a Gemini key to begin."
              : !canGenerate
                ? "Type a topic, or pick a subject that has a cheat sheet or study guide."
                : "Ready."}
          </p>
          <Button type="button" disabled={!canGenerate || loading} onClick={() => void generate()}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Drawing…" : "Generate"}
          </Button>
        </div>
      </div>

      {status.kind === "error" ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
          <p className="text-ink">{status.message}</p>
        </div>
      ) : null}

      {/* Empty state */}
      {!result && status.kind !== "loading" ? (
        <div className="mt-8 flex flex-col items-center gap-4 py-8 text-center">
          <Puffer size={96} />
          <p className="max-w-sm text-sm text-ink-muted">
            Pick a subject or type a topic, and I&apos;ll draw it out as a diagram
            you can read and zoom into.
          </p>
        </div>
      ) : null}

      {/* Result */}
      {result ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{result.title || "Diagram"}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {DIAGRAM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={loading || !canGenerate}
                  onClick={() => void generate(t)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    result.type === t
                      ? "border-[color:var(--accent)] text-[color:var(--accent-deep)]"
                      : "border-default text-ink-muted hover:text-ink"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <MermaidDiagram code={result.mermaid} />

          {result.key.length > 0 ? (
            <div className="rounded-[12px] border border-default bg-surface-2/40 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Key</p>
              <ul className="flex flex-col gap-1.5 text-sm text-ink">
                {result.key.map((k, i) => (
                  <li key={i}>
                    <span className="font-semibold">{k.label}</span> — {k.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !canGenerate}
              onClick={() => void generate(result.type)}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
