"use client";

import * as React from "react";
import { Trash2, FileText, Mic, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubjectFile } from "@/lib/cloud-subjects";

type Props = {
  file: SubjectFile;
  onCaptionChange: (next: string) => void;
  onDelete: () => void;
};

// "Voice note · 0:42" — the placeholder set right after upload, before
// transcription replaces it. We treat this as "still transcribing".
const PLACEHOLDER_RE = /^Voice note · \d+:\d{2}$/;

export function ImageGridItem({ file, onCaptionChange, onDelete }: Props) {
  const [caption, setCaption] = React.useState(file.caption);
  const isPdf = file.mimeType === "application/pdf";
  const isAudio = file.mimeType.startsWith("audio/");
  const isTranscribing = isAudio && PLACEHOLDER_RE.test(file.caption);

  React.useEffect(() => {
    setCaption(file.caption);
  }, [file.caption]);

  function commit() {
    if (caption !== file.caption) {
      onCaptionChange(caption);
    }
  }

  return (
    <div className="group glow-card flex flex-col gap-2 border border-default bg-surface p-3 transition-shadow">
      <div className="relative overflow-hidden rounded-[10px] bg-surface-2">
        {isAudio ? (
          <div className="flex flex-col items-center justify-center gap-2 px-3 py-4">
            <div className="flex w-full items-center gap-2">
              <Mic className="h-5 w-5 flex-shrink-0 text-[color:var(--accent)]" strokeWidth={1.75} />
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Voice note
              </span>
            </div>
            <audio src={file.blobUrl} controls preload="metadata" className="w-full" />
          </div>
        ) : isPdf ? (
          <a
            href={file.blobUrl}
            target="_blank"
            rel="noopener"
            className="flex aspect-[4/3] h-full w-full flex-col items-center justify-center gap-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label="Open PDF in new tab"
          >
            <FileText className="h-10 w-10 text-[color:var(--accent)]" strokeWidth={1.5} />
            <span className="text-xs font-bold uppercase tracking-wider">PDF</span>
          </a>
        ) : (
          <div className="aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.blobUrl}
              alt={caption || "uploaded note"}
              className="h-full w-full object-cover"
            />
          </div>
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

      {isAudio ? (
        <TranscriptionEditor
          value={caption}
          onChange={setCaption}
          onCommit={commit}
          isTranscribing={isTranscribing}
        />
      ) : (
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={commit}
          placeholder="Add a note about this file…"
          className="w-full rounded-[8px] bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] focus-visible:outline-offset-2"
        />
      )}
    </div>
  );
}

function TranscriptionEditor({
  value,
  onChange,
  onCommit,
  isTranscribing,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  isTranscribing: boolean;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = React.useState(false);

  // Auto-resize textarea so the entire transcript is visible without scrollbars.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
          {isTranscribing ? "Transcribing…" : "Transcription"}
        </span>
        {!isTranscribing ? (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
            {focused ? (
              <>
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Edits save when you click away
              </>
            ) : (
              <>
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Click to edit
              </>
            )}
          </span>
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onCommit();
        }}
        rows={2}
        placeholder={
          isTranscribing
            ? "Transcribing your voice note — you'll be able to edit it here in a moment."
            : "Edit the transcription. The model can mishear words; tweak as needed."
        }
        disabled={isTranscribing}
        className={cn(
          "w-full resize-none rounded-[10px] border border-default bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint",
          "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] focus-visible:outline-offset-2",
          "transition-colors hover:border-strong",
          isTranscribing && "animate-pulse cursor-wait opacity-70",
        )}
      />
    </div>
  );
}
