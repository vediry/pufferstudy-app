import { describe, it, expect } from "vitest";
import { THEMES, REQUIRED_VARS, isThemeId, migrateLegacyTheme, DEFAULT_THEME, type ThemeId } from "@/lib/themes";

describe("themes", () => {
  it("defines exactly 5 cozy themes with stable ids", () => {
    const ids = THEMES.map((t) => t.id).sort();
    expect(ids).toEqual<ThemeId[]>(["cocoa", "latte", "oat", "plum", "sage"]);
  });

  it("defaults to latte", () => {
    expect(DEFAULT_THEME).toBe("latte");
    expect(THEMES.some((t) => t.id === DEFAULT_THEME)).toBe(true);
  });

  it("every theme defines every required CSS variable", () => {
    for (const theme of THEMES) {
      for (const v of REQUIRED_VARS) {
        expect(theme.css[v], `${theme.id} missing ${v}`).toBeTruthy();
      }
    }
  });

  it("light/dark mode is set correctly per theme", () => {
    const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
    expect(byId.latte.mode).toBe("light");
    expect(byId.oat.mode).toBe("light");
    expect(byId.sage.mode).toBe("light");
    expect(byId.cocoa.mode).toBe("dark");
    expect(byId.plum.mode).toBe("dark");
  });
});

describe("isThemeId", () => {
  it("accepts the 5 known ids", () => {
    expect(isThemeId("latte")).toBe(true);
    expect(isThemeId("oat")).toBe(true);
    expect(isThemeId("sage")).toBe(true);
    expect(isThemeId("cocoa")).toBe(true);
    expect(isThemeId("plum")).toBe(true);
  });
  it("rejects retired and unknown ids", () => {
    expect(isThemeId("atelier")).toBe(false);
    expect(isThemeId("midnight")).toBe(false);
    expect(isThemeId("light")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(123)).toBe(false);
  });
});

describe("migrateLegacyTheme", () => {
  it("maps v2.0–v2.2 word ids", () => {
    expect(migrateLegacyTheme("light")).toBe("latte");
    expect(migrateLegacyTheme("dark")).toBe("cocoa");
    expect(migrateLegacyTheme("forest")).toBe("sage");
  });
  it("maps v2.3 gold-era ids to cozy", () => {
    expect(migrateLegacyTheme("atelier")).toBe("oat");
    expect(migrateLegacyTheme("platinum")).toBe("sage");
    expect(migrateLegacyTheme("spacegrey")).toBe("cocoa");
    expect(migrateLegacyTheme("midnight")).toBe("plum");
  });
  it("passes through cozy ids", () => {
    expect(migrateLegacyTheme("latte")).toBe("latte");
    expect(migrateLegacyTheme("plum")).toBe("plum");
  });
  it("returns null for unknown values", () => {
    expect(migrateLegacyTheme(null)).toBe(null);
    expect(migrateLegacyTheme("hot-pink")).toBe(null);
  });
});
