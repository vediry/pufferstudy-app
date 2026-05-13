"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertSubject } from "@/lib/store";
import { uuid } from "@/lib/utils";

export default function NewSubjectPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [testDate, setTestDate] = React.useState("");
  const [testLabel, setTestLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your subject a name so you can find it later.");
      return;
    }
    const id = uuid();
    upsertSubject({
      id,
      name: trimmed,
      testDate: testDate || null,
      testLabel: testLabel.trim() || undefined,
      createdAt: new Date().toISOString(),
      imageIds: [],
      captions: {},
    });
    router.push(`/subjects/${id}`);
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to subjects
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New subject</CardTitle>
          <CardDescription>
            What class or unit are you studying? You can add photos right after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                Subject name <span aria-hidden="true" className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Biology — Chapter 8"
                autoComplete="off"
                autoFocus
                required
                aria-invalid={!!error}
                aria-describedby={error ? "name-error" : undefined}
              />
              {error ? (
                <p id="name-error" className="text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="testDate">Test date</Label>
              <Input
                id="testDate"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
              <p className="text-[13px] text-ink-faint">
                We&apos;ll show how many days are left on your dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="testLabel">Unit or test label (optional)</Label>
              <Input
                id="testLabel"
                value={testLabel}
                onChange={(e) => setTestLabel(e.target.value)}
                placeholder="e.g. Unit 6 Quiz"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" size="lg">Create subject</Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
