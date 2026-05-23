"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { useDeskTheme, THEMES } from "@/components/theme-provider";

export function ThemePicker() {
  const { themeId, setTheme } = useDeskTheme();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glow-on-hover inline-flex items-center gap-2 rounded-[10px] border border-default bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose theme"
      >
        <span
          className="h-4 w-4 rounded-full border border-default"
          style={{ background: active.swatch }}
          aria-hidden
        />
        <span>{active.name.split(" ")[1] ?? active.name}</span>
        <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] border border-strong bg-surface shadow-lifted"
        >
          <div className="border-b border-default px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === themeId}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2 ${
                t.id === themeId ? "bg-surface-2 font-semibold" : "font-medium"
              }`}
            >
              <span
                className="h-[18px] w-[18px] rounded-full border border-default"
                style={{ background: t.swatch }}
                aria-hidden
              />
              <span className="flex-1 text-left text-ink">{t.name}</span>
              {t.id === themeId ? (
                <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2.5} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
