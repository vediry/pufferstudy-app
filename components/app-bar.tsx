import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ThemePicker } from "@/components/theme-picker";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-default bg-[color:var(--surface)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/70">
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
