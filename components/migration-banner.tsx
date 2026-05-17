"use client";

import * as React from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSubjects, deleteSubject as deleteOldSubject } from "@/lib/store";
import { getImage, deleteImage } from "@/lib/db";
import { createSubject, fetchSubjects, uploadFile } from "@/lib/cloud-subjects";
import type { Subject as OldSubject } from "@/types";

const MIGRATED_FLAG_KEY = "pufferstudy_migrated_at";

type Phase =
  | { kind: "hidden" }
  | { kind: "ready"; oldSubjects: OldSubject[] }
  | { kind: "uploading"; progress: string }
  | { kind: "done"; uploaded: number; skipped: number }
  | { kind: "error"; message: string };

type Props = {
  onMigrated: () => void;
};

export function MigrationBanner({ onMigrated }: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "hidden" });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(MIGRATED_FLAG_KEY)) return;
    const old = getSubjects();
    if (old.length === 0) {
      localStorage.setItem(MIGRATED_FLAG_KEY, new Date().toISOString());
      return;
    }
    setPhase({ kind: "ready", oldSubjects: old });
  }, []);

  async function upload() {
    if (phase.kind !== "ready") return;
    const { oldSubjects } = phase;

    // Mark migration started IMMEDIATELY so reloads/duplicate clicks don't retrigger
    localStorage.setItem(MIGRATED_FLAG_KEY, new Date().toISOString());
    setPhase({ kind: "uploading", progress: "Starting…" });

    let uploaded = 0;
    let skipped = 0;
    try {
      // Fetch existing cloud subjects so we don't duplicate
      const existingCloud = await fetchSubjects();
      const existingNames = new Set(
        existingCloud.map((s) => s.name.trim().toLowerCase()),
      );

      for (let i = 0; i < oldSubjects.length; i++) {
        const old = oldSubjects[i];
        const normalizedName = old.name.trim().toLowerCase();

        if (existingNames.has(normalizedName)) {
          setPhase({
            kind: "uploading",
            progress: `Skipping "${old.name}" — already in your account.`,
          });
          deleteOldSubject(old.id);
          for (const imgId of old.imageIds) {
            await deleteImage(imgId).catch(() => undefined);
          }
          skipped++;
          continue;
        }

        setPhase({
          kind: "uploading",
          progress: `Uploading "${old.name}" (${i + 1} of ${oldSubjects.length})…`,
        });

        const created = await createSubject({
          name: old.name,
          testLabel: old.testLabel ?? null,
          testDate: old.testDate ?? null,
        });
        existingNames.add(normalizedName);

        for (let j = 0; j < old.imageIds.length; j++) {
          const imgId = old.imageIds[j];
          const rec = await getImage(imgId);
          if (!rec) continue;
          setPhase({
            kind: "uploading",
            progress: `"${old.name}" file ${j + 1} of ${old.imageIds.length}…`,
          });
          const caption = old.captions[imgId] ?? "";
          const file = new File([rec.blob], `migrated-${imgId}`, {
            type: rec.mimeType || "image/jpeg",
          });
          await uploadFile(created.id, file, caption);
          await deleteImage(imgId).catch(() => undefined);
        }

        deleteOldSubject(old.id);
        uploaded++;
      }

      setPhase({ kind: "done", uploaded, skipped });
      onMigrated();
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Migration failed partway through.",
      });
    }
  }

  function skip() {
    localStorage.setItem(MIGRATED_FLAG_KEY, "skipped");
    setPhase({ kind: "hidden" });
  }

  if (phase.kind === "hidden") return null;

  return (
    <div className="mb-6 rounded-[var(--radius-lg)] border border-default bg-surface p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)]/12 text-[var(--primary)]">
          {phase.kind === "uploading" ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Upload className="h-5 w-5" strokeWidth={1.75} />
          )}
        </div>
        <div className="flex-1">
          {phase.kind === "ready" ? (
            <>
              <p className="font-medium text-ink">
                Found {phase.oldSubjects.length}{" "}
                {phase.oldSubjects.length === 1 ? "subject" : "subjects"} stored in this browser
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Upload them to your account so they appear on other devices?
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={upload} size="sm">
                  Upload
                </Button>
                <Button onClick={skip} variant="ghost" size="sm">
                  Skip
                </Button>
              </div>
            </>
          ) : phase.kind === "uploading" ? (
            <>
              <p className="font-medium text-ink">Uploading your subjects…</p>
              <p className="mt-1 text-sm text-ink-muted">{phase.progress}</p>
            </>
          ) : phase.kind === "done" ? (
            <>
              <p className="font-medium text-ink">
                {phase.uploaded === 0 && phase.skipped > 0
                  ? `Already in your account — ${phase.skipped} subject${phase.skipped === 1 ? "" : "s"} skipped`
                  : phase.skipped > 0
                  ? `Done — ${phase.uploaded} uploaded, ${phase.skipped} skipped (already in your account)`
                  : `Done — ${phase.uploaded} ${phase.uploaded === 1 ? "subject" : "subjects"} uploaded`}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                They&apos;ll now appear on every device you sign in from.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-ink">Migration ran into a snag</p>
              <p className="mt-1 text-sm text-[var(--danger)]">{phase.message}</p>
              <div className="mt-3">
                <Button onClick={skip} variant="ghost" size="sm">
                  Dismiss
                </Button>
              </div>
            </>
          )}
        </div>
        {phase.kind === "ready" || phase.kind === "done" ? (
          <button
            type="button"
            onClick={skip}
            aria-label="Dismiss"
            className="ml-2 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-faint hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
