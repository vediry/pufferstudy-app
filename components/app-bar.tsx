import Link from "next/link";
import { Settings } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ThemePicker } from "@/components/theme-picker";
import { WallpaperToggle } from "@/components/wallpaper-mode";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-default bg-[color:var(--surface)]">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-2 text-ink no-underline">
          <span
            className="text-[1.4rem] leading-none"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Puffer<span className="italic" style={{ color: "var(--accent-deep)" }}>Study</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <ThemePicker />
          <WallpaperToggle />
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="glow-on-hover inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-default bg-surface-2 text-ink-muted hover:text-ink"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Link>
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
