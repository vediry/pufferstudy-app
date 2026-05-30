import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Puffer } from "@/components/puffer";

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/60 px-6 py-16 text-center">
      <Puffer size={128} />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          No subjects yet
        </h2>
        <p className="max-w-md text-[15px] text-ink-muted">
          Add a class or unit, then upload photos of your notes. When test day comes,
          PufferStudy turns it all into a tidy cheat sheet.
        </p>
      </div>
      <Button asChild>
        <Link href="/subjects/new">
          <Plus />
          New subject
        </Link>
      </Button>
    </div>
  );
}
