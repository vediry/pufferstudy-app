"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, AlertCircle, GraduationCap } from "lucide-react";
import { getSettings } from "@/lib/store";
import { Puffer } from "@/components/puffer";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { Button } from "@/components/ui/button";

// Render ```mermaid fenced blocks as live diagrams; everything else stays normal.
const MD_COMPONENTS: Components = {
  pre({ children }) {
    if (React.isValidElement(children)) {
      const props = children.props as { className?: string; children?: unknown };
      if (/language-mermaid/.test(props.className ?? "")) {
        return <MermaidDiagram code={String(props.children ?? "")} />;
      }
    }
    return <pre>{children}</pre>;
  },
};

type Turn = { role: "user" | "assistant"; text: string; suggestions?: string[] };
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string };

const SUGGESTED = [
  "Explain how recursion works",
  "Quiz me on the French Revolution",
  "I'm stuck on this: 2x + 5 = 17",
  "What's the difference between mitosis and meiosis?",
];

export default function TutorPage() {
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setApiKey(getSettings().geminiKey);
  }, []);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const sending = status.kind === "sending";
  const hasKey = !!apiKey;

  const send = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      if (!apiKey) {
        setStatus({ kind: "error", message: "Add your Gemini API key in Settings first." });
        return;
      }

      const next: Turn[] = [...messages, { role: "user", text }];
      setMessages(next);
      setInput("");
      setStatus({ kind: "sending" });

      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, messages: next }),
        });
        const data = (await res.json().catch(() => null)) as
          | { text?: string; suggestions?: string[]; error?: string }
          | null;
        if (!res.ok || !data?.text) {
          setStatus({ kind: "error", message: data?.error ?? "Something went wrong. Try again." });
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.text!, suggestions: data.suggestions ?? [] },
        ]);
        setStatus({ kind: "idle" });
      } catch {
        setStatus({ kind: "error", message: "Couldn't reach the tutor. Check your connection." });
      }
    },
    [apiKey, messages, sending],
  );

  return (
    <div className="mx-auto flex max-w-[760px] flex-col px-4 py-8 pb-24">
      <header className="mb-5 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">Tutor</h1>
            <span
              className="pill border border-default px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted"
              style={{ background: "var(--surface-2)" }}
            >
              Demo
            </span>
          </div>
          <p className="text-[13px] text-ink-muted">
            An adaptive study tutor — explains, hints, or quizzes you. Ask about anything.
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
            to use the tutor.
          </p>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="glow-card flex min-h-[420px] flex-col gap-3 overflow-y-auto border border-default bg-surface px-4 py-4"
        style={{ maxHeight: "60vh" }}
      >
        {messages.length === 0 && status.kind !== "sending" ? (
          <div className="animate-fade-up m-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
            <Puffer size={96} />
            <p className="text-sm text-ink-muted">
              Hi! I&apos;m your study buddy. Tell me what you&apos;re working on — I can explain it,
              nudge you when you&apos;re close, or quiz you. Try one:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!hasKey}
                  onClick={() => void send(p)}
                  className="rounded-full border border-default bg-surface-2 px-3 py-1 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="animate-fade-up flex justify-end">
              <div className="max-w-[85%] rounded-[16px] rounded-br-[4px] bg-surface-2 px-3.5 py-2 text-sm text-ink">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="animate-fade-up flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <Puffer size={26} />
              </div>
              <div className="prose prose-sm max-w-[85%] rounded-[16px] rounded-bl-[4px] bg-[var(--primary)]/8 px-3.5 py-2 text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                  {m.text}
                </ReactMarkdown>
              </div>
            </div>
          ),
        )}

        {(() => {
          const last = messages[messages.length - 1];
          if (
            status.kind === "idle" &&
            last?.role === "assistant" &&
            last.suggestions &&
            last.suggestions.length > 0
          ) {
            return (
              <div className="flex flex-wrap gap-2 pl-8">
                {last.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!hasKey || sending}
                    onClick={() => void send(s)}
                    className="animate-fade-up rounded-full border border-default bg-surface-2 px-3 py-1 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          }
          return null;
        })()}

        {sending ? (
          <div className="flex items-center gap-2 text-sm text-ink-faint">
            <Puffer size={26} className="puffer-happy" />
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
            </span>
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
            <p className="text-ink">{status.message}</p>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={hasKey ? "Ask the tutor anything…" : "Add your Gemini key in Settings first"}
          disabled={!hasKey || sending}
          rows={2}
          className="flex-1 resize-none rounded-[20px] border border-default bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button type="submit" disabled={!hasKey || sending || !input.trim()} aria-label="Send">
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}
