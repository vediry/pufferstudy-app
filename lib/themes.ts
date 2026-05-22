export type ThemeId = "atelier" | "platinum" | "spacegrey" | "midnight";
export type ThemeMode = "light" | "dark";

export type Theme = {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  swatch: string;
  css: Record<string, string>;
};

export const REQUIRED_VARS = [
  "--accent",
  "--accent-deep",
  "--accent-light",
  "--bg",
  "--bg-grad-bottom",
  "--bg-grad-top",
  "--border",
  "--border-strong",
  "--danger",
  "--ink",
  "--ink-faint",
  "--ink-muted",
  "--primary",
  "--primary-foreground",
  "--surface",
  "--surface-2",
  "--surface-3",
  "--warn",
] as const;

export const THEMES: Theme[] = [
  {
    id: "atelier",
    name: "Gold Atelier",
    mode: "light",
    swatch: "linear-gradient(135deg, #d4b06e, #b08842)",
    css: {
      "--bg": "#faf6ec",
      "--bg-grad-top": "#faf6ec",
      "--bg-grad-bottom": "#f3ecd9",
      "--surface": "#fffaef",
      "--surface-2": "#f5edd6",
      "--surface-3": "#ece1c0",
      "--border": "#d8c89c",
      "--border-strong": "#c9a96e",
      "--ink": "#2c241a",
      "--ink-muted": "#6b5d44",
      "--ink-faint": "#9c8d70",
      "--accent": "#b08842",
      "--accent-light": "#d4b06e",
      "--accent-deep": "#8c6a30",
      "--primary": "#b08842",
      "--primary-foreground": "#fffaef",
      "--warn": "#a8531e",
      "--danger": "#8c2a1f",
    },
  },
  {
    id: "platinum",
    name: "Platinum Cloud",
    mode: "light",
    swatch: "linear-gradient(135deg, #e0e4e9, #8a9099)",
    css: {
      "--bg": "#fafbfc",
      "--bg-grad-top": "#fafbfc",
      "--bg-grad-bottom": "#eceff3",
      "--surface": "#ffffff",
      "--surface-2": "#f1f3f5",
      "--surface-3": "#e0e4e9",
      "--border": "#d1d5db",
      "--border-strong": "#9ca3af",
      "--ink": "#1d242c",
      "--ink-muted": "#4b5563",
      "--ink-faint": "#6b7480",
      "--accent": "#4a5159",
      "--accent-light": "#9ca3af",
      "--accent-deep": "#2a2f37",
      "--primary": "#2a2f37",
      "--primary-foreground": "#fafbfc",
      "--warn": "#b45309",
      "--danger": "#991b1b",
    },
  },
  {
    id: "spacegrey",
    name: "Space Grey",
    mode: "dark",
    swatch: "linear-gradient(135deg, #383631, #1c1b18)",
    css: {
      "--bg": "#1c1b18",
      "--bg-grad-top": "#2a2926",
      "--bg-grad-bottom": "#1c1b18",
      "--surface": "#2f2d29",
      "--surface-2": "#3a3833",
      "--surface-3": "#4a473f",
      "--border": "rgba(255,255,255,0.08)",
      "--border-strong": "rgba(255,255,255,0.18)",
      "--ink": "#ece6d7",
      "--ink-muted": "#bab2a0",
      "--ink-faint": "#8a8478",
      "--accent": "#c9a96e",
      "--accent-light": "#d4b78a",
      "--accent-deep": "#a8884c",
      "--primary": "#c9a96e",
      "--primary-foreground": "#1c1b18",
      "--warn": "#e89940",
      "--danger": "#ff9d8e",
    },
  },
  {
    id: "midnight",
    name: "Midnight Library",
    mode: "dark",
    swatch: "linear-gradient(135deg, #161e30, #060912)",
    css: {
      "--bg": "#0e1320",
      "--bg-grad-top": "#0e1320",
      "--bg-grad-bottom": "#060912",
      "--surface": "#161e30",
      "--surface-2": "#1b2538",
      "--surface-3": "#243049",
      "--border": "rgba(212,183,138,0.12)",
      "--border-strong": "rgba(212,183,138,0.3)",
      "--ink": "#ece1c8",
      "--ink-muted": "#bdb39a",
      "--ink-faint": "#8a8a82",
      "--accent": "#d4b78a",
      "--accent-light": "#e6cba0",
      "--accent-deep": "#a89060",
      "--primary": "#d4b78a",
      "--primary-foreground": "#0e1320",
      "--warn": "#e89940",
      "--danger": "#ff9d8e",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "atelier";
export const STORAGE_KEY = "pufferstudy.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "atelier" || value === "platinum" || value === "spacegrey" || value === "midnight";
}

/**
 * Migrate legacy v2.0–v2.2 theme ids to v2.3 ids.
 * Light → atelier, Dark → spacegrey, Forest → atelier (forest's warmth maps
 * cleanest to gold over moss green).
 */
export function migrateLegacyTheme(legacy: string | null): ThemeId | null {
  if (legacy === "light") return "atelier";
  if (legacy === "dark") return "spacegrey";
  if (legacy === "forest") return "atelier";
  if (isThemeId(legacy)) return legacy;
  return null;
}
