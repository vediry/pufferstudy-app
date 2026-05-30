"use client";

import * as React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Check,
  Coffee,
  ArrowRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useDeskTheme } from "@/components/theme-provider";
import { timerGlowFor, type ThemeId } from "@/lib/themes";

const STATE_KEY = "pufferstudy.pomodoro";

// Sentinel glow value meaning "follow the active theme's per-phase default".
const AUTO = "auto";
const SETTINGS_KEY = "pufferstudy.pomodoro-settings";
const CUSTOM_KEY = "pufferstudy.custom-timer";

type Phase = "focus" | "shortBreak" | "longBreak";
type Mode = "pomodoro" | "custom";

type Settings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  focusGlow: string;
  shortBreakGlow: string;
  longBreakGlow: string;
  customGlow: string;
  glowIntensity: number;
  chimeEnabled: boolean;
  notificationsEnabled: boolean;
  mode: Mode;
  customMinutes: number;
};

const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  // "auto" = follow the active theme's per-phase glow default (see lib/themes.ts).
  // Users can still pin a fixed color per phase, which overrides Auto on every theme.
  focusGlow: AUTO,
  shortBreakGlow: AUTO,
  longBreakGlow: AUTO,
  customGlow: AUTO,
  glowIntensity: 3,
  chimeEnabled: true,
  notificationsEnabled: false,
  mode: "pomodoro",
  customMinutes: 10,
};

// Resolve a stored glow value: the AUTO sentinel maps to the active theme's
// per-phase default; any other value is an explicit hex the user pinned.
function resolveGlow(value: string, themeId: ThemeId, phase: Phase): string {
  if (value !== AUTO) return value;
  return timerGlowFor(themeId, phase);
}

function effectiveGlowColor(s: Settings, mode: Mode, phase: Phase, themeId: ThemeId): string {
  if (mode === "custom") return resolveGlow(s.customGlow, themeId, "focus");
  if (phase === "focus") return resolveGlow(s.focusGlow, themeId, "focus");
  if (phase === "shortBreak") return resolveGlow(s.shortBreakGlow, themeId, "shortBreak");
  return resolveGlow(s.longBreakGlow, themeId, "longBreak");
}

// Glow stops per intensity level. Numbers are blur radii in px.
// Level 3 (strong) matches the original 4-layer stack shipped in 1a0c3da.
const GLOW_STOPS: Record<number, number[]> = {
  0: [],
  1: [2, 5],
  2: [3, 9, 18],
  3: [4, 12, 26, 50],
  4: [6, 16, 36, 72, 120],
};

const GLOW_LEVEL_LABELS = ["Off", "Soft", "Medium", "Strong", "Extreme"];

function glowShadow(color: string, level: number): string | undefined {
  const stops = GLOW_STOPS[level] ?? GLOW_STOPS[3];
  if (stops.length === 0) return undefined;
  return stops.map((blur) => `0 0 ${blur}px ${color}`).join(", ");
}

function clampIntensity(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  const f = Math.floor(n);
  if (f < 0 || f > 4) return fallback;
  return f;
}

function isMode(v: unknown): v is Mode {
  return v === "pomodoro" || v === "custom";
}

const GLOW_SWATCHES: { name: string; value: string }[] = [
  { name: "Amber", value: "#e8b14b" },
  { name: "Green", value: "#4ade80" },
  { name: "Red", value: "#f87171" },
  { name: "Cyan", value: "#67e8f9" },
  { name: "Violet", value: "#c084fc" },
  { name: "White", value: "#fafafa" },
];

const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

// Notification message for the phase that JUST ended.
const PHASE_END_MSG: Record<Phase, { title: string; body: string }> = {
  focus: { title: "Focus block complete", body: "Time for a break." },
  shortBreak: { title: "Break over", body: "Back to focus." },
  longBreak: { title: "Long break over", body: "Back to focus." },
};

const CUSTOM_END_MSG = { title: "Timer complete", body: "Your custom timer is up." };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function durations(s: Settings): Record<Phase, number> {
  return {
    focus: s.focusMinutes * 60,
    shortBreak: s.shortBreakMinutes * 60,
    longBreak: s.longBreakMinutes * 60,
  };
}

type PomodoroState = {
  phase: Phase;
  running: boolean;
  endTime: number | null;
  remainingSeconds: number;
  completedFocusBlocks: number;
};

function defaultState(s: Settings = DEFAULT_SETTINGS): PomodoroState {
  return {
    phase: "focus",
    running: false,
    endTime: null,
    remainingSeconds: durations(s).focus,
    completedFocusBlocks: 0,
  };
}

function loadState(s: Settings): PomodoroState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState(s);
    const parsed = JSON.parse(raw);
    if (!["focus", "shortBreak", "longBreak"].includes(parsed.phase)) return defaultState(s);
    return parsed as PomodoroState;
  } catch {
    return defaultState(s);
  }
}

type CustomTimerState = {
  running: boolean;
  endTime: number | null;
  remainingSeconds: number;
};

function defaultCustomState(s: Settings = DEFAULT_SETTINGS): CustomTimerState {
  return {
    running: false,
    endTime: null,
    remainingSeconds: s.customMinutes * 60,
  };
}

function loadCustomState(s: Settings): CustomTimerState {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return defaultCustomState(s);
    const parsed = JSON.parse(raw) as Partial<CustomTimerState>;
    return {
      running: !!parsed.running,
      endTime: typeof parsed.endTime === "number" ? parsed.endTime : null,
      remainingSeconds:
        typeof parsed.remainingSeconds === "number" && parsed.remainingSeconds >= 0
          ? Math.floor(parsed.remainingSeconds)
          : s.customMinutes * 60,
    };
  } catch {
    return defaultCustomState(s);
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings> & { glowColor?: string };

    // Migration: pre-per-phase saves had a single `glowColor`.
    const legacyGlow =
      typeof parsed.glowColor === "string" && HEX_RE.test(parsed.glowColor)
        ? parsed.glowColor
        : null;
    // The fixed hexes that USED to be the defaults (before per-theme Auto). A saved
    // value equal to its old default means the user never customized that phase, so
    // we adopt the new Auto behavior; anything else is a deliberate pin we keep.
    const OLD_DEFAULTS: Record<"focus" | "shortBreak" | "longBreak" | "custom", string> = {
      focus: "#e8b14b",
      shortBreak: "#86efac",
      longBreak: "#a78bfa",
      custom: "#e8b14b",
    };
    const normalizeGlow = (v: unknown, oldDefault: string): string => {
      const candidate =
        v === AUTO ? AUTO : typeof v === "string" && HEX_RE.test(v) ? v : legacyGlow;
      if (candidate == null || candidate === AUTO) return AUTO;
      if (candidate.toLowerCase() === oldDefault.toLowerCase()) return AUTO;
      return candidate;
    };

    return {
      focusMinutes: clampMinutes(parsed.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
      shortBreakMinutes: clampMinutes(parsed.shortBreakMinutes, DEFAULT_SETTINGS.shortBreakMinutes),
      longBreakMinutes: clampMinutes(parsed.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes),
      focusGlow: normalizeGlow(parsed.focusGlow, OLD_DEFAULTS.focus),
      shortBreakGlow: normalizeGlow(parsed.shortBreakGlow, OLD_DEFAULTS.shortBreak),
      longBreakGlow: normalizeGlow(parsed.longBreakGlow, OLD_DEFAULTS.longBreak),
      customGlow: normalizeGlow(parsed.customGlow, OLD_DEFAULTS.custom),
      glowIntensity: clampIntensity(parsed.glowIntensity, DEFAULT_SETTINGS.glowIntensity),
      chimeEnabled:
        typeof parsed.chimeEnabled === "boolean" ? parsed.chimeEnabled : DEFAULT_SETTINGS.chimeEnabled,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
      mode: isMode(parsed.mode) ? parsed.mode : DEFAULT_SETTINGS.mode,
      customMinutes: clampMinutes(parsed.customMinutes, DEFAULT_SETTINGS.customMinutes),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clampMinutes(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(999, Math.floor(n));
}

function pickNextPhase(prev: PomodoroState): Phase {
  if (prev.phase === "focus") {
    return prev.completedFocusBlocks + 1 >= 4 ? "longBreak" : "shortBreak";
  }
  return "focus";
}

function nextCompletedBlocks(prev: PomodoroState): number {
  if (prev.phase !== "focus") return prev.completedFocusBlocks;
  return prev.completedFocusBlocks + 1 >= 4 ? 0 : prev.completedFocusBlocks + 1;
}

// --- Web Audio chime: lazy AudioContext, two overlapping sine bells. ---

let audioCtxSingleton: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtxSingleton) return audioCtxSingleton;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtxSingleton = new Ctor();
    return audioCtxSingleton;
  } catch {
    return null;
  }
}

function playChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const playTone = (freq: number, start: number, duration: number, peak: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.start(start);
    osc.stop(start + duration);
  };
  playTone(523.25, now, 0.55, 0.18); // C5
  playTone(659.25, now + 0.18, 0.7, 0.16); // E5 overlap
}

function fireNotification(msg: { title: string; body: string }) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Don't bug the user if they're actively looking at the tab.
  if (document.visibilityState === "visible") return;
  try {
    new Notification(msg.title, { body: msg.body, tag: "pufferstudy-pomodoro" });
  } catch {
    /* notification blocked or unsupported */
  }
}

export function PomodoroTimer() {
  const { themeId } = useDeskTheme();
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [state, setState] = React.useState<PomodoroState>(defaultState);
  const [customState, setCustomState] = React.useState<CustomTimerState>(defaultCustomState);
  const [, forceTick] = React.useState(0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [minimalView, setMinimalView] = React.useState(false);
  const hydratedRef = React.useRef(false);

  // ESC exits minimal view. Runtime-only state — refresh always starts with full chrome.
  React.useEffect(() => {
    if (!minimalView) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMinimalView(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [minimalView]);

  function toggleMinimal() {
    setMinimalView((prev) => {
      const next = !prev;
      if (next) setSettingsOpen(false);
      return next;
    });
  }

  React.useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setState(loadState(s));
    setCustomState(loadCustomState(s));
    hydratedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(customState));
    } catch {}
  }, [customState]);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // One ticker drives both timers; whichever is running re-renders via forceTick.
  React.useEffect(() => {
    if (!state.running && !customState.running) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.running, customState.running]);

  const pomodoroDisplaySeconds =
    state.running && state.endTime
      ? Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000))
      : state.remainingSeconds;

  const customDisplaySeconds =
    customState.running && customState.endTime
      ? Math.max(0, Math.ceil((customState.endTime - Date.now()) / 1000))
      : customState.remainingSeconds;

  // Pomodoro phase-end
  React.useEffect(() => {
    if (state.running && pomodoroDisplaySeconds <= 0) {
      if (settings.chimeEnabled) playChime();
      if (settings.notificationsEnabled) fireNotification(PHASE_END_MSG[state.phase]);
      const nxt = pickNextPhase(state);
      setState({
        phase: nxt,
        running: false,
        endTime: null,
        remainingSeconds: durations(settings)[nxt],
        completedFocusBlocks: nextCompletedBlocks(state),
      });
    }
  }, [pomodoroDisplaySeconds, state, settings]);

  // Custom timer end
  React.useEffect(() => {
    if (customState.running && customDisplaySeconds <= 0) {
      if (settings.chimeEnabled) playChime();
      if (settings.notificationsEnabled) fireNotification(CUSTOM_END_MSG);
      setCustomState({
        running: false,
        endTime: null,
        remainingSeconds: settings.customMinutes * 60,
      });
    }
  }, [customDisplaySeconds, customState, settings]);

  function startOrPause() {
    setState((prev) => {
      if (prev.running) {
        const remaining = prev.endTime
          ? Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000))
          : prev.remainingSeconds;
        return { ...prev, running: false, endTime: null, remainingSeconds: remaining };
      }
      // Authorize AudioContext on this user gesture so phase-end chime can play later.
      if (settings.chimeEnabled) getAudioContext();
      return { ...prev, running: true, endTime: Date.now() + prev.remainingSeconds * 1000 };
    });
  }

  function reset() {
    setState((prev) => ({
      ...prev,
      running: false,
      endTime: null,
      remainingSeconds: durations(settings)[prev.phase],
    }));
  }

  function skip() {
    setState((prev) => {
      const nxt = pickNextPhase(prev);
      return {
        phase: nxt,
        running: false,
        endTime: null,
        remainingSeconds: durations(settings)[nxt],
        completedFocusBlocks: nextCompletedBlocks(prev),
      };
    });
  }

  function takeLongBreak() {
    setState({
      phase: "longBreak",
      running: false,
      endTime: null,
      remainingSeconds: durations(settings).longBreak,
      completedFocusBlocks: 0,
    });
    setSettingsOpen(false);
  }

  function endBreak() {
    setState((prev) => ({
      phase: "focus",
      running: false,
      endTime: null,
      remainingSeconds: durations(settings).focus,
      completedFocusBlocks: prev.completedFocusBlocks,
    }));
    setSettingsOpen(false);
  }

  function startOrPauseCustom() {
    setCustomState((prev) => {
      if (prev.running) {
        const remaining = prev.endTime
          ? Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000))
          : prev.remainingSeconds;
        return { running: false, endTime: null, remainingSeconds: remaining };
      }
      if (settings.chimeEnabled) getAudioContext();
      return {
        running: true,
        endTime: Date.now() + prev.remainingSeconds * 1000,
        remainingSeconds: prev.remainingSeconds,
      };
    });
  }

  function resetCustom() {
    setCustomState({
      running: false,
      endTime: null,
      remainingSeconds: settings.customMinutes * 60,
    });
  }

  function updateCustomMinutes(rawValue: number) {
    const clamped = clampMinutes(rawValue, settings.customMinutes);
    const prevSeconds = settings.customMinutes * 60;
    setSettings((prev) => ({ ...prev, customMinutes: clamped }));
    // If timer is idle on the prior default, snap to new value so the LCD reflects it.
    setCustomState((prev) =>
      !prev.running && prev.remainingSeconds === prevSeconds
        ? { ...prev, remainingSeconds: clamped * 60 }
        : prev,
    );
  }

  function switchMode(next: Mode) {
    if (settings.mode === next) return;
    // Pause whichever timer is running so the other mode starts in a known state.
    if (state.running) {
      setState((prev) => {
        const remaining = prev.endTime
          ? Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000))
          : prev.remainingSeconds;
        return { ...prev, running: false, endTime: null, remainingSeconds: remaining };
      });
    }
    if (customState.running) {
      setCustomState((prev) => {
        const remaining = prev.endTime
          ? Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000))
          : prev.remainingSeconds;
        return { running: false, endTime: null, remainingSeconds: remaining };
      });
    }
    setSettings((prev) => ({ ...prev, mode: next }));
    setSettingsOpen(false);
  }

  function applyDurations(d: Pick<Settings, "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes">) {
    const merged: Settings = { ...settings, ...d };
    const prevDur = durations(settings)[state.phase];
    const nextDur = durations(merged)[state.phase];
    setSettings(merged);
    if (!state.running && state.remainingSeconds === prevDur) {
      setState((prev) => ({ ...prev, remainingSeconds: nextDur }));
    }
    setSettingsOpen(false);
  }

  function updateLive(partial: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (
      partial.notificationsEnabled === true &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }

  const isCustom = settings.mode === "custom";
  const currentSeconds = isCustom ? customDisplaySeconds : pomodoroDisplaySeconds;
  const minutes = Math.floor(currentSeconds / 60);
  const seconds = currentSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isRunning = isCustom ? customState.running : state.running;
  const currentGlow = effectiveGlowColor(settings, settings.mode, state.phase, themeId);
  // Cycle dots always track the focus glow (status indicators, not the live phase).
  const focusDotGlow = resolveGlow(settings.focusGlow, themeId, "focus");
  const chromeClass = minimalView
    ? "transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
    : "";

  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center px-6 ${
        minimalView ? "group" : ""
      }`}
    >
      <div className={`inline-flex ${chromeClass}`}>
        <ModeToggle mode={settings.mode} onChange={switchMode} />
      </div>

      <div
        className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint ${chromeClass}`}
      >
        {isCustom ? "Custom timer" : PHASE_LABELS[state.phase]}
      </div>

      {/* LCD display: ghost 88:88 behind, glowing time on top, stacked via grid. */}
      <div
        className="mt-4 select-none leading-none"
        style={{
          fontFamily: '"DSEG7 Classic", var(--font-sans)',
          display: "grid",
          placeItems: "center",
        }}
      >
        <span
          aria-hidden
          className="text-[5.5rem] sm:text-[8rem]"
          style={{
            color: currentGlow,
            opacity: 0.08,
            gridArea: "1 / 1",
          }}
        >
          88:88
        </span>
        <span
          className="text-[5.5rem] sm:text-[8rem]"
          style={{
            color: currentGlow,
            gridArea: "1 / 1",
            textShadow: glowShadow(currentGlow, settings.glowIntensity),
          }}
        >
          {timeStr}
        </span>
      </div>

      {isCustom ? (
        <div className={chromeClass}>
          <CustomMinutesField
            minutes={settings.customMinutes}
            onCommit={updateCustomMinutes}
            disabled={customState.running}
          />
        </div>
      ) : (
        <div
          className={`mt-6 flex items-center gap-2 ${chromeClass}`}
          aria-label={`${state.completedFocusBlocks} of 4 focus blocks completed`}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < state.completedFocusBlocks;
            return (
              <div
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: filled
                    ? focusDotGlow
                    : "color-mix(in srgb, var(--ink-faint) 35%, transparent)",
                  boxShadow:
                    filled && settings.glowIntensity > 0
                      ? `0 0 4px ${focusDotGlow}`
                      : undefined,
                }}
              />
            );
          })}
        </div>
      )}

      <div className={`mt-10 flex items-center gap-3 ${chromeClass}`}>
        <button
          type="button"
          onClick={isCustom ? startOrPauseCustom : startOrPause}
          className="glow-on-hover inline-flex h-12 items-center gap-2 border border-default bg-surface-2 px-6 text-sm font-semibold text-ink"
          aria-label={isRunning ? "Pause timer" : "Start timer"}
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" strokeWidth={2} /> Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" strokeWidth={2} /> Start
            </>
          )}
        </button>
        <button
          type="button"
          onClick={isCustom ? resetCustom : reset}
          aria-label={isCustom ? "Reset timer" : "Reset current phase"}
          title={isCustom ? "Reset timer" : "Reset current phase"}
          className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </button>
        {!isCustom ? (
          <>
            <button
              type="button"
              onClick={skip}
              aria-label="Skip to next phase"
              title="Skip to next phase"
              className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
            >
              <SkipForward className="h-4 w-4" strokeWidth={2} />
            </button>
            {state.phase === "focus" ? (
              <button
                type="button"
                onClick={takeLongBreak}
                aria-label="Take a long break now"
                title="Take a long break now"
                className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
              >
                <Coffee className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : (
              <button
                type="button"
                onClick={endBreak}
                aria-label="End break and resume focus"
                title="End break and resume focus"
                className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </>
        ) : null}
        <button
          type="button"
          onClick={toggleMinimal}
          aria-label={minimalView ? "Exit focus view" : "Enter focus view"}
          aria-pressed={minimalView}
          title={minimalView ? "Exit focus view (Esc)" : "Focus view — hide everything but the timer"}
          className={`glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default text-ink-muted hover:text-ink ${
            minimalView ? "bg-surface-3 text-ink" : "bg-surface-2"
          }`}
        >
          {minimalView ? (
            <Minimize2 className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Maximize2 className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Customize timer"
          aria-expanded={settingsOpen}
          title="Customize timer"
          className={`glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default text-ink-muted hover:text-ink ${
            settingsOpen ? "bg-surface-3 text-ink" : "bg-surface-2"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {settingsOpen ? (
        <div className={chromeClass}>
          <SettingsPanel
            settings={settings}
            currentGlow={currentGlow}
            themeId={themeId}
            onApplyDurations={applyDurations}
            onUpdateLive={updateLive}
            onCancel={() => setSettingsOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (next: Mode) => void }) {
  return (
    <div className="inline-flex border border-default bg-surface-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
      {(["pomodoro", "custom"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={`px-3 py-1.5 transition-colors ${
              active ? "bg-surface-3 text-ink" : "text-ink-faint hover:text-ink"
            }`}
          >
            {m === "pomodoro" ? "Pomodoro" : "Custom"}
          </button>
        );
      })}
    </div>
  );
}

function CustomMinutesField({
  minutes,
  onCommit,
  disabled,
}: {
  minutes: number;
  onCommit: (v: number) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = React.useState(String(minutes));

  // Sync external changes (e.g. from settings panel) into the local draft.
  React.useEffect(() => {
    setDraft(String(minutes));
  }, [minutes]);

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 1) {
      onCommit(Math.floor(n));
    } else {
      setDraft(String(minutes));
    }
  }

  return (
    <div className="mt-6 flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">Set</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={999}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(String(minutes));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        className="h-8 w-16 border border-default bg-surface-2 px-2 text-right text-sm font-semibold text-ink tabular focus:outline-none focus:border-strong disabled:opacity-50"
      />
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">min</span>
    </div>
  );
}

function SettingsPanel({
  settings,
  currentGlow,
  themeId,
  onApplyDurations,
  onUpdateLive,
  onCancel,
}: {
  settings: Settings;
  currentGlow: string;
  themeId: ThemeId;
  onApplyDurations: (
    next: Pick<Settings, "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes">,
  ) => void;
  onUpdateLive: (partial: Partial<Settings>) => void;
  onCancel: () => void;
}) {
  const [focus, setFocus] = React.useState(String(settings.focusMinutes));
  const [shortBreak, setShortBreak] = React.useState(String(settings.shortBreakMinutes));
  const [longBreak, setLongBreak] = React.useState(String(settings.longBreakMinutes));

  function handleApplyDurations() {
    onApplyDurations({
      focusMinutes: clampMinutes(focus, settings.focusMinutes),
      shortBreakMinutes: clampMinutes(shortBreak, settings.shortBreakMinutes),
      longBreakMinutes: clampMinutes(longBreak, settings.longBreakMinutes),
    });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApplyDurations();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="mt-6 w-[320px] border border-default bg-surface p-4">
      <SectionLabel>Pomodoro durations</SectionLabel>
      <div className="mt-2 flex flex-col gap-3">
        <Row label="Focus" value={focus} onChange={setFocus} onKey={onKey} />
        <Row label="Short break" value={shortBreak} onChange={setShortBreak} onKey={onKey} />
        <Row label="Long break" value={longBreak} onChange={setLongBreak} onKey={onKey} />
      </div>
      <button
        type="button"
        onClick={handleApplyDurations}
        className="glow-on-hover mt-3 inline-flex h-9 w-full items-center justify-center gap-2 border border-default bg-surface-2 text-sm font-semibold text-ink"
      >
        <Check className="h-4 w-4" strokeWidth={2} /> Apply
      </button>

      <Divider />

      <SectionLabel>Glow color</SectionLabel>
      <div className="mt-2 flex flex-col gap-2">
        <SwatchRow
          label="Focus"
          value={settings.focusGlow}
          autoColor={timerGlowFor(themeId, "focus")}
          onChange={(v) => onUpdateLive({ focusGlow: v })}
        />
        <SwatchRow
          label="Short break"
          value={settings.shortBreakGlow}
          autoColor={timerGlowFor(themeId, "shortBreak")}
          onChange={(v) => onUpdateLive({ shortBreakGlow: v })}
        />
        <SwatchRow
          label="Long break"
          value={settings.longBreakGlow}
          autoColor={timerGlowFor(themeId, "longBreak")}
          onChange={(v) => onUpdateLive({ longBreakGlow: v })}
        />
        <SwatchRow
          label="Custom"
          value={settings.customGlow}
          autoColor={timerGlowFor(themeId, "focus")}
          onChange={(v) => onUpdateLive({ customGlow: v })}
        />
      </div>

      <Divider />

      <SectionLabel>Glow strength</SectionLabel>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={4}
          step={1}
          value={settings.glowIntensity}
          onChange={(e) => onUpdateLive({ glowIntensity: Number(e.target.value) })}
          aria-label="Glow strength"
          className="flex-1 cursor-pointer"
          style={{ accentColor: currentGlow }}
        />
        <span className="w-16 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {GLOW_LEVEL_LABELS[settings.glowIntensity] ?? "Strong"}
        </span>
      </div>

      <Divider />

      <SectionLabel>Sound &amp; alerts</SectionLabel>
      <div className="mt-2 flex flex-col gap-2.5">
        <Toggle
          label="Chime when timer ends"
          checked={settings.chimeEnabled}
          onChange={(v) => onUpdateLive({ chimeEnabled: v })}
        />
        <Toggle
          label="Browser notifications"
          checked={settings.notificationsEnabled}
          onChange={(v) => onUpdateLive({ notificationsEnabled: v })}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-4 h-px w-full bg-[color:var(--border)] opacity-50" />;
}

function Row({
  label,
  value,
  onChange,
  onKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          className="h-8 w-16 border border-default bg-surface-2 px-2 text-right text-sm font-semibold text-ink tabular focus:outline-none focus:border-strong"
        />
        <span className="text-xs text-ink-faint">min</span>
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 text-left"
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center border bg-surface-2 ${
          checked ? "border-strong" : "border-default"
        }`}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
      </span>
      <span className="text-sm text-ink-muted">{label}</span>
    </button>
  );
}

function SwatchRow({
  label,
  value,
  autoColor,
  onChange,
}: {
  label: string;
  value: string;
  autoColor: string;
  onChange: (color: string) => void;
}) {
  const isAuto = value === AUTO;
  // Native color inputs need a real hex; show the resolved theme color when on Auto.
  const colorInputValue = isAuto ? autoColor : value;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[84px] text-xs text-ink-muted">{label}</span>
      <div className="flex items-center gap-1">
        {/* Auto = follow the active theme. Shows the resolved color with an "A" badge. */}
        <button
          type="button"
          onClick={() => onChange(AUTO)}
          aria-label={`${label} glow: Auto, match theme`}
          title="Auto — match theme"
          className="relative h-5 w-5 rounded-full border transition-shadow"
          style={{
            background: autoColor,
            borderColor: isAuto
              ? "var(--ink)"
              : "color-mix(in srgb, var(--border) 60%, transparent)",
            boxShadow: isAuto ? `0 0 4px ${autoColor}, 0 0 10px ${autoColor}` : undefined,
          }}
        >
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-white"
            style={{ textShadow: "0 0 2px rgba(0,0,0,0.55)" }}
          >
            A
          </span>
        </button>
        {GLOW_SWATCHES.map((s) => {
          const active = !isAuto && value.toLowerCase() === s.value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              aria-label={`${label} glow: ${s.name}`}
              title={s.name}
              className="h-5 w-5 rounded-full border transition-shadow"
              style={{
                background: s.value,
                borderColor: active
                  ? "var(--ink)"
                  : "color-mix(in srgb, var(--border) 60%, transparent)",
                boxShadow: active ? `0 0 4px ${s.value}, 0 0 10px ${s.value}` : undefined,
              }}
            />
          );
        })}
        <label
          className="relative ml-0.5 inline-block h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-default"
          title={`Custom ${label.toLowerCase()} color`}
          aria-label={`Custom ${label} glow color`}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
            }}
          />
          <input
            type="color"
            value={colorInputValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
