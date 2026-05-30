export type ThemeId = "latte" | "oat" | "sage" | "cocoa" | "plum";
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
    id: "latte",
    name: "Latte",
    mode: "light",
    swatch: "linear-gradient(135deg, #f1ebdd, #c98a6d)",
    css: {
      "--bg": "#e9e0d0",
      "--bg-grad-top": "#ece4d6",
      "--bg-grad-bottom": "#e2d8c4",
      "--surface": "#f1ebdd",
      "--surface-2": "#e4d9c4",
      "--surface-3": "#d8cbb0",
      "--border": "#ddd0ba",
      "--border-strong": "#c9b692",
      "--ink": "#3d362e",
      "--ink-muted": "#7a6f5c",
      "--ink-faint": "#9c8e76",
      "--accent": "#c98a6d",
      "--accent-light": "#dda98f",
      "--accent-deep": "#a86a4f",
      "--primary": "#c98a6d",
      "--primary-foreground": "#fffaf4",
      "--warn": "#b9742f",
      "--danger": "#b5452f",
    },
  },
  {
    id: "oat",
    name: "Oat",
    mode: "light",
    swatch: "linear-gradient(135deg, #fdfbf7, #c98a6d)",
    css: {
      "--bg": "#f4efe7",
      "--bg-grad-top": "#f7f2ea",
      "--bg-grad-bottom": "#efe8da",
      "--surface": "#fdfbf7",
      "--surface-2": "#f0e8da",
      "--surface-3": "#e7dcc8",
      "--border": "#eadfd0",
      "--border-strong": "#d6c4a4",
      "--ink": "#3d362e",
      "--ink-muted": "#8a8073",
      "--ink-faint": "#b3a591",
      "--accent": "#c98a6d",
      "--accent-light": "#dda98f",
      "--accent-deep": "#a86a4f",
      "--primary": "#c98a6d",
      "--primary-foreground": "#fffaf4",
      "--warn": "#b9742f",
      "--danger": "#b5452f",
    },
  },
  {
    id: "sage",
    name: "Sage",
    mode: "light",
    swatch: "linear-gradient(135deg, #eef1ea, #7f9a6e)",
    css: {
      "--bg": "#eef1ea",
      "--bg-grad-top": "#f1f4ec",
      "--bg-grad-bottom": "#e8ece2",
      "--surface": "#fafbf7",
      "--surface-2": "#e6ebe0",
      "--surface-3": "#d9e0d0",
      "--border": "#dde3d6",
      "--border-strong": "#b9c4ad",
      "--ink": "#33392f",
      "--ink-muted": "#6e7567",
      "--ink-faint": "#97a08c",
      "--accent": "#7f9a6e",
      "--accent-light": "#9bb38a",
      "--accent-deep": "#5f7a50",
      "--primary": "#7f9a6e",
      "--primary-foreground": "#fafbf7",
      "--warn": "#b9742f",
      "--danger": "#b5452f",
    },
  },
  {
    id: "cocoa",
    name: "Cocoa",
    mode: "dark",
    swatch: "linear-gradient(135deg, #241f1a, #e0a17e)",
    css: {
      "--bg": "#241f1a",
      "--bg-grad-top": "#2b251f",
      "--bg-grad-bottom": "#1e1915",
      "--surface": "#322b23",
      "--surface-2": "#3b332a",
      "--surface-3": "#463c30",
      "--border": "rgba(243,235,221,0.10)",
      "--border-strong": "rgba(243,235,221,0.22)",
      "--ink": "#f3ebdd",
      "--ink-muted": "#c2b39e",
      "--ink-faint": "#8a7d6c",
      "--accent": "#e0a17e",
      "--accent-light": "#ecb79b",
      "--accent-deep": "#c07e5a",
      "--primary": "#e0a17e",
      "--primary-foreground": "#241f1a",
      "--warn": "#e89f5a",
      "--danger": "#f0998a",
    },
  },
  {
    id: "plum",
    name: "Plum",
    mode: "dark",
    swatch: "linear-gradient(135deg, #211b29, #b9a0e0)",
    css: {
      "--bg": "#211b29",
      "--bg-grad-top": "#271f31",
      "--bg-grad-bottom": "#1b1622",
      "--surface": "#2e2638",
      "--surface-2": "#372e44",
      "--surface-3": "#443a52",
      "--border": "rgba(239,231,243,0.10)",
      "--border-strong": "rgba(239,231,243,0.22)",
      "--ink": "#efe7f3",
      "--ink-muted": "#c0b3cc",
      "--ink-faint": "#8c7e98",
      "--accent": "#b9a0e0",
      "--accent-light": "#cdb8ec",
      "--accent-deep": "#9b80c8",
      "--primary": "#b9a0e0",
      "--primary-foreground": "#211b29",
      "--warn": "#e89f5a",
      "--danger": "#f0998a",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "latte";
export const STORAGE_KEY = "pufferstudy.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return (
    value === "latte" ||
    value === "oat" ||
    value === "sage" ||
    value === "cocoa" ||
    value === "plum"
  );
}

/**
 * Migrate older theme ids to the cozy-redesign ids.
 *
 * - v2.0–v2.2 word ids: light → latte, dark → cocoa, forest → sage.
 * - v2.3 gold-era ids: atelier → oat (brightest cozy light),
 *   platinum → sage (nearest cozy light), spacegrey → cocoa, midnight → plum.
 * - Already-cozy ids pass through unchanged.
 */
export function migrateLegacyTheme(legacy: string | null): ThemeId | null {
  switch (legacy) {
    case "light":
      return "latte";
    case "dark":
      return "cocoa";
    case "forest":
      return "sage";
    case "atelier":
      return "oat";
    case "platinum":
      return "sage";
    case "spacegrey":
      return "cocoa";
    case "midnight":
      return "plum";
    default:
      return isThemeId(legacy) ? legacy : null;
  }
}
