"use client";

import * as React from "react";
import { Upload, Loader2, Camera, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { resizeImageBlob } from "@/lib/db";
import { getSettings } from "@/lib/store";
import {
  uploadFile,
  transcribeFile,
  updateFileCaption,
  type SubjectFile,
} from "@/lib/cloud-subjects";
import { VoiceRecorder } from "@/components/voice-recorder";

type Props = {
  subjectId: string;
  onUploaded: (files: SubjectFile[]) => void;
  className?: string;
};

const ACCEPTED_MIME = ["image/", "application/pdf"];

function isAccepted(file: File): boolean {
  return ACCEPTED_MIME.some((prefix) =>
    prefix.endsWith("/") ? file.type.startsWith(prefix) : file.type === prefix,
  );
}

export function ImageUploader({ subjectId, onUploaded, className }: Props) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = React.useState(false);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    try {
      const list = Array.from(files).filter(isAccepted);
      if (list.length === 0) {
        setError("Pick photos (JPG/PNG/HEIC) or PDFs.");
        return;
      }
      const uploaded: SubjectFile[] = [];
      for (const file of list) {
        const isPdf = file.type === "application/pdf";
        const blob = isPdf ? file : await resizeImageBlob(file);
        const blobAsFile = blob instanceof File
          ? blob
          : new File([blob], file.name || (isPdf ? "doc.pdf" : "photo.jpg"), {
              type: blob.type || (isPdf ? "application/pdf" : "image/jpeg"),
            });
        const record = await uploadFile(subjectId, blobAsFile, "");
        uploaded.push(record);
      }
      onUploaded(uploaded);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Couldn't add those files: ${err.message}`
          : "Couldn't add those files. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVoiceNote(blob: Blob, durationSec: number) {
    const apiKey = getSettings().geminiKey;
    const filename = `voice-note-${Date.now()}.webm`;
    const file = new File([blob], filename, { type: blob.type || "audio/webm" });
    const placeholderCaption = `Voice note · ${formatDuration(durationSec)}`;

    const record = await uploadFile(subjectId, file, placeholderCaption);
    onUploaded([record]);

    if (apiKey) {
      try {
        const transcription = await transcribeFile(record.id, apiKey);
        if (transcription) {
          await updateFileCaption(subjectId, record.id, transcription);
          onUploaded([{ ...record, caption: transcription }]);
        }
      } catch (err) {
        console.error("transcription failed:", err);
        // Leave the placeholder caption; user can edit manually
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor="camera-capture-input"
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-default bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors",
            "hover:bg-surface-3 sm:hidden",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <Camera className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Take a photo
          <input
            id="camera-capture-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setRecorderOpen((v) => !v)}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-default bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors",
            "hover:bg-surface-3",
            busy && "pointer-events-none opacity-70",
            recorderOpen && "bg-surface-3 border-strong",
          )}
        >
          <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {recorderOpen ? "Hide recorder" : "Record voice note"}
        </button>
      </div>

      {recorderOpen ? (
        <VoiceRecorder
          onSave={handleVoiceNote}
          onClose={() => setRecorderOpen(false)}
        />
      ) : null}

      <label
        htmlFor="image-uploader-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-default bg-surface-2/50 px-6 py-10 text-center transition-colors",
          "hover:border-strong hover:bg-surface-2",
          drag && "border-[var(--primary)] bg-[var(--primary)]/8",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" strokeWidth={1.75} />
        ) : (
          <Upload className="h-7 w-7 text-[var(--primary)]" strokeWidth={1.75} />
        )}
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium text-ink">
            {busy ? "Uploading…" : "Drop photos or PDFs here, or click to pick"}
          </p>
          <p className="text-[13px] text-ink-faint">
            Photos get resized to save bandwidth. PDFs uploaded as-is.
          </p>
        </div>
        <input
          id="image-uploader-input"
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </label>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
