"use client";

import * as React from "react";
import { Upload, Loader2, Camera } from "lucide-react";
import { cn, uuid } from "@/lib/utils";
import { putImage, resizeImageBlob } from "@/lib/db";

type Props = {
  onUploaded: (ids: string[]) => void;
  className?: string;
};

const ACCEPTED_MIME = ["image/", "application/pdf"];

function isAccepted(file: File): boolean {
  return ACCEPTED_MIME.some((prefix) =>
    prefix.endsWith("/") ? file.type.startsWith(prefix) : file.type === prefix,
  );
}

export function ImageUploader({ onUploaded, className }: Props) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    try {
      const list = Array.from(files).filter(isAccepted);
      if (list.length === 0) {
        setError("Pick photos (JPG/PNG/HEIC) or PDFs.");
        return;
      }
      const ids: string[] = [];
      for (const file of list) {
        const isPdf = file.type === "application/pdf";
        const blob = isPdf ? file : await resizeImageBlob(file);
        const id = uuid();
        await putImage({
          id,
          blob,
          mimeType: blob.type || (isPdf ? "application/pdf" : "image/jpeg"),
          addedAt: new Date().toISOString(),
        });
        ids.push(id);
      }
      onUploaded(ids);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Couldn't add those files: ${err.message}`
          : "Couldn't add those files. Try a different browser or check storage permissions.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
            {busy ? "Adding files…" : "Drop photos or PDFs here, or click to pick"}
          </p>
          <p className="text-[13px] text-ink-faint">
            Photos get resized to save space. PDFs uploaded as-is.
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
