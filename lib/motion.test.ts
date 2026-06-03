import { describe, it, expect } from "vitest";
import { shouldAnimate, staggerDelayMs } from "./motion";

describe("shouldAnimate", () => {
  it("animates when motion is allowed and IntersectionObserver exists", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: false, hasIntersectionObserver: true }),
    ).toBe(true);
  });

  it("does not animate when the user prefers reduced motion", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: true, hasIntersectionObserver: true }),
    ).toBe(false);
  });

  it("does not animate when IntersectionObserver is unavailable", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: false, hasIntersectionObserver: false }),
    ).toBe(false);
  });
});

describe("staggerDelayMs", () => {
  it("returns 0 for the first item", () => {
    expect(staggerDelayMs(0)).toBe(0);
  });

  it("scales linearly with index using the default step", () => {
    expect(staggerDelayMs(3)).toBe(180);
  });

  it("respects a custom step", () => {
    expect(staggerDelayMs(2, 100)).toBe(200);
  });

  it("clamps negative indices to 0", () => {
    expect(staggerDelayMs(-5)).toBe(0);
  });
});
