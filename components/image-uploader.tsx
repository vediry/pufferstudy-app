"use client";

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn, uuid } from "@/lib/utils";
import { putImage, resizeImageBlob } from "@/lib/db";

type Props = {
  onUploaded: (ids: string[]) => void;
  className?: string;
};

export function ImageUploader({ onUploaded, className }: Props) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) {
        setError("Pick image files (JPG, PNG, HEIC).");
        return;
      }
      const ids: string[] = [];
      for (const file of list) {
        const resized = await resizeImageBlob(file);
        const id = uuid();
        await putImage({
          id,
          blob: resized,
          mimeType: resized.type || "image/jpeg",
          addedAt: new Date().toISOString(),
        });
        ids.push(id);
      }
      onUploaded(ids);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Couldn't add those images: ${err.message}`
          : "Couldn't add those images. Try a different browser or check storage permissions.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
          <ImagePlus className="h-7 w-7 text-[var(--primary)]" strokeWidth={1.75} />
        )}
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium text-ink">
            {busy ? "Adding photos…" : "Drop photos here or click to pick"}
          </p>
          <p className="text-[13px] text-ink-faint">
            Multiple photos OK. We&apos;ll resize them to save space.
          </p>
        </div>
        <input
          id="image-uploader-input"
          ref={fileInput}
          type="file"
          accept="image/*"
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
