"use client";

import * as React from "react";
import {
  THEMES,
  DEFAULT_THEME,
  STORAGE_KEY,
  isThemeId,
  migrateLegacyTheme,
  type ThemeId,
} from "@/lib/themes";

type ThemeCtx = {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const Ctx = React.createContext<ThemeCtx | null>(null);

/**
 * Inline script that runs BEFORE React hydrates. Reads localStorage,
 * migrates legacy v2.0–v2.2 ids, and sets data-theme on <html>. Prevents
 * a flash of the default palette on first render.
 */
export function ThemeAntiFlashScript() {
  const code = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    // Keep in sync with migrateLegacyTheme() in lib/themes.ts
    var legacy = {
      light: "latte", dark: "cocoa", forest: "sage",
      atelier: "oat", platinum: "sage", spacegrey: "cocoa", midnight: "plum"
    };
    var id = legacy[stored] || stored;
    var valid = ["latte","oat","sage","cocoa","plum"];
    if (valid.indexOf(id) === -1) id = ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", id);
    if (id !== stored) localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, id);
  } catch (_) {}
})();
`.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = React.useState<ThemeId>(DEFAULT_THEME);

  React.useEffect(() => {
    const raw = document.documentElement.getAttribute("data-theme");
    if (isThemeId(raw)) {
      setThemeIdState(raw);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      const migrated = migrateLegacyTheme(stored);
      const resolved = migrated ?? DEFAULT_THEME;
      setThemeIdState(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    }
  }, []);

  const setTheme = React.useCallback((id: ThemeId) => {
    setThemeIdState(id);
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage disabled — proceed without persistence.
    }
    void fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {});
  }, []);

  const value = React.useMemo(() => ({ themeId, setTheme }), [themeId, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeskTheme(): ThemeCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useDeskTheme must be used inside <ThemeProvider>");
  return ctx;
}

export { THEMES };
