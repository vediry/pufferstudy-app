"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/image-uploader";
import { ImageGridItem } from "@/components/image-grid-item";
import {
  useSubject,
  deleteSubject,
  deleteFile,
  updateFileCaption,
  type SubjectFile,
} from "@/lib/cloud-subjects";
import { countdownLabel, countdownTone, daysUntil } from "@/lib/utils";

export default function SubjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { subject, error, refresh, setSubject } = useSubject(id);

  function onUploaded(newFiles: SubjectFile[]) {
    if (!subject) return;
    setSubject({ ...subject, files: [...subject.files, ...newFiles] });
  }

  async function onCaption(file: SubjectFile, caption: string) {
    if (!subject) return;
    setSubject({
      ...subject,
      files: subject.files.map((f) => (f.id === file.id ? { ...f, caption } : f)),
    });
    try {
      await updateFileCaption(subject.id, file.id, caption);
    } catch (err) {
      console.error(err);
      refresh();
    }
  }

  async function onDeleteFile(file: SubjectFile) {
    if (!subject) return;
    const previous = subject.files;
    setSubject({ ...subject, files: subject.files.filter((f) => f.id !== file.id) });
    try {
      await deleteFile(subject.id, file.id);
    } catch (err) {
      console.error(err);
      setSubject({ ...subject, files: previous });
    }
  }

  async function onDeleteSubject() {
    if (!subject) return;
    if (!window.confirm(`Delete "${subject.name}" and its files?`)) return;
    try {
      await deleteSubject(subject.id);
      router.push("/");
    } catch (err) {
      console.error(err);
    }
  }

  if (subject === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-surface-2/60" />
      </div>
    );
  }

  if (subject === null) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold text-ink">Subject not found</h1>
        <p className="mb-6 text-ink-muted">
          {error ?? "It may have been deleted."}
        </p>
        <Button asChild>
          <Link href="/">Back to subjects</Link>
        </Button>
      </div>
    );
  }

  const days = daysUntil(subject.testDate);
  const tone = countdownTone(days);
  const label = countdownLabel(days);
  const empty = subject.files.length === 0;
  const canGenerate = !empty;
  const hasCheatsheet = !!subject.cheatsheetMarkdown;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to subjects
      </Link>

      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Badge tone={tone}>{label}</Badge>
          <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-ink sm:text-[2.25rem]">
            {subject.name}
          </h1>
          {subject.testLabel ? (
            <p className="text-[15px] text-ink-muted">{subject.testLabel}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild={canGenerate}
            disabled={!canGenerate}
            title={canGenerate ? "Generate cheat sheet" : "Add at least one file first"}
          >
            {canGenerate ? (
              <Link href={`/subjects/${subject.id}/cheatsheet`}>
                <Sparkles />
                {hasCheatsheet ? "Open cheat sheet" : "Generate cheat sheet"}
              </Link>
            ) : (
              <>
                <Sparkles />
                Generate cheat sheet
              </>
            )}
          </Button>
          <Button variant="secondary" disabled title="Coming soon">
            <MessageSquare />
            Chat
          </Button>
          <Button variant="ghost" size="icon" onClick={onDeleteSubject} aria-label="Delete subject">
            <Trash2 />
          </Button>
        </div>
      </header>

      <section className="mb-8">
        <ImageUploader subjectId={subject.id} onUploaded={onUploaded} />
      </section>

      {empty ? (
        <div className="rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center text-ink-muted">
          <p className="text-[15px]">
            No files yet. Snap a photo of your notes, drop in a PDF, or upload a packet — then come back here.
          </p>
        </div>
      ) : (
        <section>
          <h2 className="mb-4 text-base font-medium text-ink-muted">
            {subject.files.length} {subject.files.length === 1 ? "file" : "files"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subject.files.map((file) => (
              <ImageGridItem
                key={file.id}
                file={file}
                onCaptionChange={(next) => onCaption(file, next)}
                onDelete={() => onDeleteFile(file)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
