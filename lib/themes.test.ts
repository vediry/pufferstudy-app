import { describe, it, expect } from "vitest";
import { THEMES, REQUIRED_VARS, isThemeId, migrateLegacyTheme, type ThemeId } from "@/lib/themes";

describe("themes", () => {
  it("defines exactly 4 themes with stable ids", () => {
    const ids = THEMES.map((t) => t.id).sort();
    expect(ids).toEqual<ThemeId[]>(["atelier", "midnight", "platinum", "spacegrey"]);
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
    expect(byId.atelier.mode).toBe("light");
    expect(byId.platinum.mode).toBe("light");
    expect(byId.spacegrey.mode).toBe("dark");
    expect(byId.midnight.mode).toBe("dark");
  });
});

describe("isThemeId", () => {
  it("accepts the 4 known ids", () => {
    expect(isThemeId("atelier")).toBe(true);
    expect(isThemeId("platinum")).toBe(true);
    expect(isThemeId("spacegrey")).toBe(true);
    expect(isThemeId("midnight")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isThemeId("light")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(123)).toBe(false);
  });
});

describe("migrateLegacyTheme", () => {
  it("maps light → atelier", () => expect(migrateLegacyTheme("light")).toBe("atelier"));
  it("maps dark → spacegrey", () => expect(migrateLegacyTheme("dark")).toBe("spacegrey"));
  it("maps forest → atelier", () => expect(migrateLegacyTheme("forest")).toBe("atelier"));
  it("passes through valid v2.3 ids", () => {
    expect(migrateLegacyTheme("platinum")).toBe("platinum");
    expect(migrateLegacyTheme("midnight")).toBe("midnight");
  });
  it("returns null for unknown values", () => {
    expect(migrateLegacyTheme(null)).toBe(null);
    expect(migrateLegacyTheme("hot-pink")).toBe(null);
  });
});
