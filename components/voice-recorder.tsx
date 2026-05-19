"use client";

import * as React from "react";
import { Mic, Square, Trash2, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Stage =
  | { kind: "idle" }
  | { kind: "permission_denied" }
  | { kind: "recording"; seconds: number }
  | { kind: "review"; blob: Blob; durationSec: number }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

const MAX_SECONDS = 5 * 60;

type Props = {
  onSave: (blob: Blob, durationSec: number) => Promise<void>;
  onClose: () => void;
};

export function VoiceRecorder({ onSave, onClose }: Props) {
  const [stage, setStage] = React.useState<Stage>({ kind: "idle" });
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setStage({ kind: "review", blob, durationSec });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      recorder.start();
      setStage({ kind: "recording", seconds: 0 });

      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (seconds >= MAX_SECONDS) {
          stopRecording();
          return;
        }
        setStage({ kind: "recording", seconds });
      }, 250);
    } catch (err) {
      console.error("mic permission error:", err);
      setStage({ kind: "permission_denied" });
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    mediaRecorderRef.current?.stop();
  }

  async function save() {
    if (stage.kind !== "review") return;
    setStage({ kind: "uploading" });
    try {
      await onSave(stage.blob, stage.durationSec);
      onClose();
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't save the recording.",
      });
    }
  }

  function redo() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setStage({ kind: "idle" });
  }

  const previewUrl = React.useMemo(() => {
    if (stage.kind !== "review") return null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(stage.blob);
    previewUrlRef.current = url;
    return url;
  }, [stage]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-default bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Voice note</p>
          <p className="mt-0.5 text-[13px] text-ink-faint">
            Record up to 5 minutes. Auto-transcribed after saving.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {stage.kind === "idle" ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Button onClick={startRecording} size="lg">
            <Mic />
            Start recording
          </Button>
        </div>
      ) : stage.kind === "permission_denied" ? (
        <div className="flex items-start gap-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--danger)]" strokeWidth={1.75} />
          <div className="flex-1 text-ink">
            <p className="font-medium">Microphone access denied</p>
            <p className="mt-0.5 text-ink-muted">
              Allow microphone access in your browser settings, then try again.
            </p>
          </div>
        </div>
      ) : stage.kind === "recording" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--danger)]" />
            </span>
            <span className="tabular text-2xl font-medium text-ink">
              {formatTime(stage.seconds)}
            </span>
            <span className="text-sm text-ink-faint">/ {formatTime(MAX_SECONDS)}</span>
          </div>
          <Button onClick={stopRecording} size="lg" variant="secondary">
            <Square />
            Stop
          </Button>
        </div>
      ) : stage.kind === "review" ? (
        <div className="flex flex-col gap-4 py-2">
          {previewUrl ? (
            <audio src={previewUrl} controls className="w-full" />
          ) : null}
          <div className="flex items-center justify-between text-[13px] text-ink-faint">
            <span>Duration: {formatTime(stage.durationSec)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} size="lg">
              <Check />
              Save & transcribe
            </Button>
            <Button onClick={redo} size="lg" variant="ghost">
              <Trash2 />
              Redo
            </Button>
          </div>
        </div>
      ) : stage.kind === "uploading" ? (
        <div className="flex items-center justify-center gap-3 py-8 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" strokeWidth={1.75} />
          Uploading and transcribing…
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--danger)]" strokeWidth={1.75} />
            <p className="flex-1 text-ink">{stage.message}</p>
          </div>
          <Button onClick={redo} variant="ghost" size="sm" className={cn("self-start")}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
