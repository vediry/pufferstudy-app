/**
 * Pure helpers for the motion layer. Kept dependency-free and DOM-free so they
 * run under Vitest's node environment (the project has no DOM test harness).
 */

/** Whether scroll/IO-driven animations should run. */
export function shouldAnimate(opts: {
  prefersReducedMotion: boolean;
  hasIntersectionObserver: boolean;
}): boolean {
  return !opts.prefersReducedMotion && opts.hasIntersectionObserver;
}

/** Stagger delay (ms) for a 0-based index; negative indices clamp to 0. */
export function staggerDelayMs(index: number, stepMs = 60): number {
  return Math.max(0, index) * stepMs;
}
