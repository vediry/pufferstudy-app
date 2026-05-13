"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImage } from "@/lib/db";

type Props = {
  imageId: string;
  caption: string;
  onCaptionChange: (next: string) => void;
  onDelete: () => void;
};

export function ImageGridItem({ imageId, caption, onCaptionChange, onDelete }: Props) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const rec = await getImage(imageId);
        if (cancelled) return;
        if (!rec) {
          setMissing(true);
          return;
        }
        const objectUrl = URL.createObjectURL(rec.blob);
        revoke = objectUrl;
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [imageId]);

  return (
    <div className="group flex flex-col gap-2 rounded-[var(--radius-lg)] border border-default bg-surface p-3 shadow-soft transition-shadow hover:shadow-card">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-surface-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={caption || "uploaded note"}
            className="h-full w-full object-cover"
          />
        ) : missing ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-faint">
            image missing
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-surface-3" />
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete image"
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
        onChange={(e) => onCaptionChange(e.target.value)}
        placeholder="Add a note about this photo…"
        className="w-full rounded-[var(--radius-sm)] bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
      />
    </div>
  );
}
