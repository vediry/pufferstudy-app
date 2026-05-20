// lib/refine-stream.ts
"use client";

import type { ChatMessage } from "@/types";

export type ParserHandlers = {
  onReplyDelta: (text: string) => void;
  onSheetDelta?: (text: string) => void;
  onSheetEdit: (full: string) => void;
};

type State =
  | { kind: "start" }              // before any tag opens
  | { kind: "in_reply" }
  | { kind: "between" }            // </reply> seen, before <sheet> or end
  | { kind: "in_sheet" }
  | { kind: "done" };

const REPLY_OPEN = "<reply>";
const REPLY_CLOSE = "</reply>";
const SHEET_OPEN = "<sheet>";
const SHEET_CLOSE = "</sheet>";

// Worst-case prefix that COULD be the start of any of the tags we care about.
// We never flush text that ends with such a prefix until we have more bytes.
const MAX_TAG_LEN = Math.max(
  REPLY_OPEN.length,
  REPLY_CLOSE.length,
  SHEET_OPEN.length,
  SHEET_CLOSE.length,
);

export class TagParser {
  private state: State = { kind: "start" };
  private buffer = "";
  private sheetBuffer = "";
  public error: string | null = null;

  constructor(private h: ParserHandlers) {}

  write(chunk: string): void {
    if (this.state.kind === "done") return;
    this.buffer += chunk;
    this.drain();
  }

  end(): void {
    // Final drain — any remaining buffer is treated as the current state's text.
    this.drain(true);
    if (this.state.kind === "in_reply") {
      this.error = "Reply tag was unclosed.";
      this.state = { kind: "done" };
      return;
    }
    if (this.state.kind === "in_sheet") {
      // Sheet never closed — discard partial sheet, surface error.
      this.error = "Sheet tag was unclosed; sheet edit discarded.";
      this.state = { kind: "done" };
      return;
    }
    this.state = { kind: "done" };
  }

  private drain(final = false): void {
    // Loop because a single chunk can carry multiple state transitions.
    while (true) {
      if (this.state.kind === "start") {
        const openIdx = this.buffer.indexOf(REPLY_OPEN);
        if (openIdx === -1) {
          if (final) {
            // No tags at all — model misbehaved. Treat the whole thing as reply text.
            if (this.buffer.length > 0) {
              this.h.onReplyDelta(this.buffer);
              this.buffer = "";
            }
            return;
          }
          // Could a partial tag be at the end? If buffer might contain a prefix of <reply>,
          // do not emit anything; just wait for more input.
          return;
        }
        // If the model emitted text before <reply>, also stream it as reply (charitable).
        if (openIdx > 0) {
          this.h.onReplyDelta(this.buffer.slice(0, openIdx));
        }
        this.buffer = this.buffer.slice(openIdx + REPLY_OPEN.length);
        this.state = { kind: "in_reply" };
        continue;
      }

      if (this.state.kind === "in_reply") {
        const closeIdx = this.buffer.indexOf(REPLY_CLOSE);
        if (closeIdx === -1) {
          // Emit everything we can safely emit (i.e. minus the last MAX_TAG_LEN-1 bytes,
          // which might be the start of </reply>).
          const safe = final ? this.buffer.length : Math.max(0, this.buffer.length - (MAX_TAG_LEN - 1));
          if (safe > 0) {
            this.h.onReplyDelta(this.buffer.slice(0, safe));
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        if (closeIdx > 0) {
          this.h.onReplyDelta(this.buffer.slice(0, closeIdx));
        }
        this.buffer = this.buffer.slice(closeIdx + REPLY_CLOSE.length);
        this.state = { kind: "between" };
        continue;
      }

      if (this.state.kind === "between") {
        // We're between </reply> and (optional) <sheet>. Skip whitespace; look for <sheet>.
        // If end-of-stream and no <sheet>, we're done.
        const openIdx = this.buffer.indexOf(SHEET_OPEN);
        if (openIdx === -1) {
          if (final) {
            this.state = { kind: "done" };
            return;
          }
          // Wait for more input.
          return;
        }
        // Anything before <sheet> is discarded (typically just whitespace/newlines).
        this.buffer = this.buffer.slice(openIdx + SHEET_OPEN.length);
        this.state = { kind: "in_sheet" };
        continue;
      }

      if (this.state.kind === "in_sheet") {
        const closeIdx = this.buffer.indexOf(SHEET_CLOSE);
        if (closeIdx === -1) {
          const safe = final ? 0 : Math.max(0, this.buffer.length - (MAX_TAG_LEN - 1));
          if (safe > 0) {
            const piece = this.buffer.slice(0, safe);
            this.sheetBuffer += piece;
            this.h.onSheetDelta?.(piece);
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        const piece = this.buffer.slice(0, closeIdx);
        if (piece.length > 0) {
          this.sheetBuffer += piece;
          this.h.onSheetDelta?.(piece);
        }
        this.buffer = this.buffer.slice(closeIdx + SHEET_CLOSE.length);
        this.h.onSheetEdit(this.sheetBuffer);
        this.state = { kind: "done" };
        return;
      }

      // state.kind === "done"
      return;
    }
  }
}

// Caps the chat history to the last N turns before sending to the model.
const HISTORY_CAP = 10;
export function capHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= HISTORY_CAP) return history;
  return history.slice(history.length - HISTORY_CAP);
}

export type RefineHandlers = {
  onReplyDelta: (text: string) => void;
  onSheetDelta?: (text: string) => void;
  onSheetEdit: (full: string) => void;
  onDone: (args: { replyText: string; sheetEdited: boolean; parserError: string | null }) => void;
  onError: (message: string, code?: string) => void;
  signal?: AbortSignal;
};

type RefineInput = {
  apiKey: string;
  subjectId: string;
  subjectName: string;
  currentSheet: string;
  history: ChatMessage[];
  message: string;
};

export async function refine(input: RefineInput, handlers: RefineHandlers): Promise<void> {
  if (!input.apiKey) {
    handlers.onError("Add your Gemini API key in Settings first.", "missing_key");
    return;
  }

  const cappedHistory = capHistory(input.history);

  let replyText = "";
  let sheetEdited = false;
  const parser = new TagParser({
    onReplyDelta: (t) => {
      replyText += t;
      handlers.onReplyDelta(t);
    },
    onSheetDelta: handlers.onSheetDelta,
    onSheetEdit: (full) => {
      sheetEdited = true;
      handlers.onSheetEdit(full);
    },
  });

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: input.apiKey,
        mode: "refine",
        subjectName: input.subjectName,
        fileIds: [],
        history: cappedHistory,
        currentSheet: input.currentSheet,
        message: input.message,
      }),
      signal: handlers.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("Couldn't reach the PufferStudy server. Check your connection.", "network");
    return;
  }

  if (!res.ok || !res.body) {
    let code = "unknown";
    let message = `Refinement failed (${res.status}).`;
    try {
      const json = (await res.json()) as { error?: string; message?: string };
      if (json.error) code = json.error;
      if (json.message) message = json.message;
    } catch {
      // body wasn't JSON
    }
    handlers.onError(message, code);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) parser.write(chunk);
    }
    parser.end();
    handlers.onDone({ replyText, sheetEdited, parserError: parser.error });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("The stream was interrupted. Try again.", "stream_failed");
  }
}
