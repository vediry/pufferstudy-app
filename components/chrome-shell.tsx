"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/app-bar";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { useWallpaperMode } from "@/components/wallpaper-mode";
import { PomodoroTimer } from "@/components/pomodoro-timer";
import { PageTransition } from "@/components/motion/page-transition";

const AUTH_PREFIXES = ["/sign-in", "/sign-up"];

/**
 * Wraps page content with the dashboard chrome (AppBar + Sidebar + MobileNav)
 * EXCEPT on auth routes (sign-in / sign-up), where we render the auth widget
 * centered in a blank canvas. Path-aware so we don't have to use route groups.
 */
export function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isAuthRoute = AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const { on: wallpaperMode } = useWallpaperMode();

  if (isAuthRoute) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        {children}
      </div>
    );
  }

  if (wallpaperMode) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppBar />
        <PomodoroTimer />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-dvh flex-col">
        <AppBar />
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
            <footer className="no-print mt-auto border-t border-default py-6 text-center text-sm text-ink-faint">
              <span className="mx-auto">PufferStudy · Your study workspace.</span>
            </footer>
          </div>
        </div>
      </div>
      <MobileNav />
    </>
  );
}
