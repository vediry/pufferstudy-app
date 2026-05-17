import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { PufferLogo } from "@/components/puffer-logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-default bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-semibold text-ink"
        >
          <PufferLogo className="h-7 w-7 text-[var(--primary)] transition-transform group-hover:rotate-[-6deg]" />
          <span className="text-[1.05rem] tracking-tight">PufferStudy</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/settings"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-default px-3 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Settings"
          >
            <SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
                userButtonPopoverCard: "bg-surface border border-default shadow-lifted",
                userButtonPopoverActionButton: "text-ink hover:bg-surface-2",
                userButtonPopoverActionButtonText: "text-ink",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
        </nav>
      </div>
    </header>
  );
}
