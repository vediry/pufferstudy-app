"use client";

import type { GenerateMode } from "@/lib/prompts";
import type { ChatMessage } from "@/types";
import type { SubjectWithFiles } from "@/lib/cloud-subjects";

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (message: string, code?: string) => void;
  signal?: AbortSignal;
};

type GenerateInput = {
  apiKey: string;
  subject: SubjectWithFiles;
  mode: GenerateMode;
  question?: string;
  history?: ChatMessage[];
};

export async function generate(input: GenerateInput, handlers: StreamHandlers): Promise<void> {
  if (!input.apiKey) {
    handlers.onError("Add your Gemini API key in Settings first.", "missing_key");
    return;
  }

  const payload = {
    apiKey: input.apiKey,
    mode: input.mode,
    subjectName: input.subject.name,
    testLabel: input.subject.testLabel ?? undefined,
    fileIds: input.subject.files.map((f) => f.id),
    question: input.question,
    history: input.history,
  };

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError(
      "Couldn't reach the PufferStudy server. Check your connection.",
      "network",
    );
    return;
  }

  if (!res.ok || !res.body) {
    let code = "unknown";
    let message = `Generation failed (${res.status}).`;
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
  let full = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        handlers.onDelta(chunk);
      }
    }
    handlers.onDone(full);
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("The stream was interrupted. Try again.", "stream_failed");
  }
}
