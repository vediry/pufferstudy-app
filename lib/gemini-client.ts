"use client";

import { getImage } from "@/lib/db";
import type { GenerateMode } from "@/lib/prompts";
import type { ChatMessage, Subject } from "@/types";

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB, comfortably under Vercel's 4.5MB serverless body limit

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (message: string, code?: string) => void;
  signal?: AbortSignal;
};

type GenerateInput = {
  apiKey: string;
  subject: Subject;
  mode: GenerateMode;
  question?: string;
  history?: ChatMessage[];
};

export async function generate(input: GenerateInput, handlers: StreamHandlers): Promise<void> {
  if (!input.apiKey) {
    handlers.onError("Add your Gemini API key in Settings first.", "missing_key");
    return;
  }

  const images: Array<{ mimeType: string; data: string }> = [];
  const captions: string[] = [];
  for (const imgId of input.subject.imageIds) {
    const rec = await getImage(imgId);
    if (!rec) continue;
    const dataUrl = await blobToBase64(rec.blob);
    images.push({ mimeType: rec.mimeType || "image/jpeg", data: dataUrl });
    captions.push(input.subject.captions[imgId] ?? "");
  }

  const payload = {
    apiKey: input.apiKey,
    mode: input.mode,
    subjectName: input.subject.name,
    testLabel: input.subject.testLabel,
    images,
    captions,
    question: input.question,
    history: input.history,
  };

  const bodyJson = JSON.stringify(payload);
  if (bodyJson.length > MAX_BODY_BYTES) {
    handlers.onError(
      "Too many photos for one request. Remove a few and try again.",
      "body_too_large",
    );
    return;
  }

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
