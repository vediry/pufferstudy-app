"use client";

import * as React from "react";
import { Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubjectFile } from "@/lib/cloud-subjects";

type Props = {
  file: SubjectFile;
  onCaptionChange: (next: string) => void;
  onDelete: () => void;
};

export function ImageGridItem({ file, onCaptionChange, onDelete }: Props) {
  const [caption, setCaption] = React.useState(file.caption);
  const isPdf = file.mimeType === "application/pdf";

  React.useEffect(() => {
    setCaption(file.caption);
  }, [file.caption]);

  // Debounced save on caption blur
  function commit() {
    if (caption !== file.caption) {
      onCaptionChange(caption);
    }
  }

  return (
    <div className="group flex flex-col gap-2 rounded-[var(--radius-lg)] border border-default bg-surface p-3 shadow-soft transition-shadow hover:shadow-card">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-surface-2">
        {isPdf ? (
          <a
            href={file.blobUrl}
            target="_blank"
            rel="noopener"
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label="Open PDF in new tab"
          >
            <FileText className="h-10 w-10 text-[var(--primary)]" strokeWidth={1.5} />
            <span className="text-xs font-medium uppercase tracking-wider">PDF</span>
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.blobUrl}
            alt={caption || "uploaded note"}
            className="h-full w-full object-cover"
          />
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete file"
          className={cn(
            "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity",
            "hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={commit}
        placeholder="Add a note about this file…"
        className="w-full rounded-[var(--radius-sm)] bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
      />
    </div>
  );
}
