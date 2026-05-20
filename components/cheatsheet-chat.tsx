"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { refine } from "@/lib/refine-stream";
import type { ChatMessage } from "@/types";

const SUGGESTED_PROMPTS = [
  "Make it shorter",
  "Add more examples",
  "Quiz me on this",
] as const;

type ChatStatus =
  | { kind: "idle" }
  | { kind: "streaming"; pendingAssistant: string }
  | { kind: "error"; message: string };

type Props = {
  subjectId: string;
  subjectName: string;
  apiKey: string | null;
  currentSheet: string;          // "" when no sheet yet
  messages: ChatMessage[];
  onTurnComplete: (args: {
    nextMessages: ChatMessage[];
    nextSheet: string | null;    // null when the turn was Q&A only
  }) => void;
};

export function CheatsheetChat({
  subjectId,
  subjectName,
  apiKey,
  currentSheet,
  messages,
  onTurnComplete,
}: Props) {
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<ChatStatus>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Stick to bottom on new messages or new streamed text.
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const disabled =
    !apiKey ||
    currentSheet.length === 0 ||
    status.kind === "streaming";

  const placeholder =
    currentSheet.length === 0
      ? "Generate the cheat sheet first to start chatting"
      : !apiKey
        ? "Add your Gemini API key in Settings to chat"
        : "Ask a question or ask me to change the sheet…";

  const send = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || disabled || !apiKey) return;

      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        ts: new Date().toISOString(),
      };
      const baseMessages = [...messages, userMsg];

      setInput("");
      setStatus({ kind: "streaming", pendingAssistant: "" });

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      let sheetFromTurn: string | null = null;

      await refine(
        {
          apiKey,
          subjectId,
          subjectName,
          currentSheet,
          history: baseMessages,   // includes the new user message
          message: text,
        },
        {
          signal: ac.signal,
          onReplyDelta: (t) => {
            setStatus((prev) =>
              prev.kind === "streaming"
                ? { kind: "streaming", pendingAssistant: prev.pendingAssistant + t }
                : prev,
            );
          },
          onSheetEdit: (full) => {
            sheetFromTurn = full;
          },
          onDone: ({ replyText, sheetEdited, parserError }) => {
            if (parserError) {
              setStatus({ kind: "error", message: parserError });
              return;
            }
            const assistantMsg: ChatMessage = {
              role: "assistant",
              content: replyText || (sheetEdited ? "Updated the sheet." : ""),
              ts: new Date().toISOString(),
              sheetEdited: sheetEdited || undefined,
            };
            const nextMessages = [...baseMessages, assistantMsg];
            setStatus({ kind: "idle" });
            onTurnComplete({
              nextMessages,
              nextSheet: sheetEdited ? sheetFromTurn : null,
            });
          },
          onError: (message) => {
            setStatus({ kind: "error", message });
          },
        },
      );
    },
    [apiKey, currentSheet, disabled, messages, onTurnComplete, subjectId, subjectName],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <section className="no-print mx-auto mt-10 w-full max-w-[760px]">
      <h2 className="mb-4 text-sm font-medium text-ink-faint">Chat with this sheet</h2>

      <div
        ref={listRef}
        className="mb-4 max-h-[480px] space-y-3 overflow-y-auto rounded-[var(--radius-lg)] border border-default bg-surface px-4 py-4"
      >
        {messages.length === 0 && status.kind === "idle" ? (
          <p className="text-sm text-ink-muted">
            Ask anything about this subject, or tell me how to change the sheet above.
          </p>
        ) : null}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {status.kind === "streaming" ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {status.pendingAssistant || "_Thinking…_"}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
            <p>{status.message}</p>
          </div>
        ) : null}
      </div>

      {messages.length === 0 && status.kind !== "streaming" ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => setInput(p)}
              className="rounded-full border border-default bg-surface px-3 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className={cn(
            "flex-1 resize-none rounded-[24px] border border-default bg-surface px-4 py-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || input.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-ink-faint">Powered by your Gemini key.</p>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="rounded-[var(--radius-md)] border border-default bg-surface-2/40 px-3 py-2 text-sm text-ink">
        {message.content}
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      {message.sheetEdited ? (
        <p className="mt-1 text-[11px] text-ink-faint">Sheet updated above.</p>
      ) : null}
    </div>
  );
}
