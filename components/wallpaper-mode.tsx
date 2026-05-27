"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "pufferstudy.wallpaper-mode";

type Ctx = {
  on: boolean;
  toggle: () => void;
  set: (v: boolean) => void;
};

const WallpaperCtx = React.createContext<Ctx | null>(null);

export function WallpaperModeProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setOn(true);
    } catch (_) {}
  }, []);

  const set = React.useCallback((v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch (_) {}
  }, []);

  const toggle = React.useCallback(() => set(!on), [on, set]);

  React.useEffect(() => {
    if (!on) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") set(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, set]);

  return <WallpaperCtx.Provider value={{ on, toggle, set }}>{children}</WallpaperCtx.Provider>;
}

export function useWallpaperMode() {
  const ctx = React.useContext(WallpaperCtx);
  if (!ctx) throw new Error("useWallpaperMode must be used within WallpaperModeProvider");
  return ctx;
}

export function WallpaperToggle() {
  const { on, toggle } = useWallpaperMode();
  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Exit theme preview" : "Preview theme"}
      title={on ? "Exit theme preview (ESC)" : "Preview theme"}
      aria-pressed={on}
      className="glow-on-hover inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-default bg-surface-2 text-ink-muted hover:text-ink"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
