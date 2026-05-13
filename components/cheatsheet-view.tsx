"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function CheatsheetView({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "cheatsheet mx-auto max-w-[760px] rounded-[var(--radius-lg)] border border-default bg-surface px-8 py-10 shadow-soft",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
