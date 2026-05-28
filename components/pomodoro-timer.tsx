"use client";

import * as React from "react";
import { Play, Pause, RotateCcw, SkipForward, SlidersHorizontal, Check } from "lucide-react";

const STATE_KEY = "pufferstudy.pomodoro";
const SETTINGS_KEY = "pufferstudy.pomodoro-settings";

type Phase = "focus" | "shortBreak" | "longBreak";

type Settings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
};

const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

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

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      focusMinutes: clampMinutes(parsed.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
      shortBreakMinutes: clampMinutes(parsed.shortBreakMinutes, DEFAULT_SETTINGS.shortBreakMinutes),
      longBreakMinutes: clampMinutes(parsed.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes),
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

export function PomodoroTimer() {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [state, setState] = React.useState<PomodoroState>(defaultState);
  const [, forceTick] = React.useState(0);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setState(loadState(s));
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
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  React.useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.running]);

  const displaySeconds =
    state.running && state.endTime
      ? Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000))
      : state.remainingSeconds;

  React.useEffect(() => {
    if (state.running && displaySeconds <= 0) {
      const nxt = pickNextPhase(state);
      setState({
        phase: nxt,
        running: false,
        endTime: null,
        remainingSeconds: durations(settings)[nxt],
        completedFocusBlocks: nextCompletedBlocks(state),
      });
    }
  }, [displaySeconds, state, settings]);

  function startOrPause() {
    setState((prev) => {
      if (prev.running) {
        const remaining = prev.endTime
          ? Math.max(0, Math.ceil((prev.endTime - Date.now()) / 1000))
          : prev.remainingSeconds;
        return { ...prev, running: false, endTime: null, remainingSeconds: remaining };
      }
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

  function applySettings(next: Settings) {
    const prevDur = durations(settings)[state.phase];
    const nextDur = durations(next)[state.phase];
    setSettings(next);
    // If the current phase is fresh (idle, full-duration), bump remaining to the new duration.
    if (!state.running && state.remainingSeconds === prevDur) {
      setState((prev) => ({ ...prev, remainingSeconds: nextDur }));
    }
    setSettingsOpen(false);
  }

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        {PHASE_LABELS[state.phase]}
      </div>
      <div
        className="mt-3 select-none text-[7rem] leading-none tracking-tight text-ink tabular sm:text-[10rem]"
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 300,
          letterSpacing: "-0.02em",
        }}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      <div
        className="mt-6 flex items-center gap-2"
        aria-label={`${state.completedFocusBlocks} of 4 focus blocks completed`}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full"
            style={{
              background:
                i < state.completedFocusBlocks
                  ? "var(--accent)"
                  : "color-mix(in srgb, var(--ink-faint) 35%, transparent)",
            }}
          />
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <button
          type="button"
          onClick={startOrPause}
          className="glow-on-hover inline-flex h-12 items-center gap-2 border border-default bg-surface-2 px-6 text-sm font-semibold text-ink"
          aria-label={state.running ? "Pause timer" : "Start timer"}
        >
          {state.running ? (
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
          onClick={reset}
          aria-label="Reset current phase"
          title="Reset current phase"
          className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={skip}
          aria-label="Skip to next phase"
          title="Skip to next phase"
          className="glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:text-ink"
        >
          <SkipForward className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Customize durations"
          aria-expanded={settingsOpen}
          title="Customize durations"
          className={`glow-on-hover inline-flex h-12 w-12 items-center justify-center border border-default text-ink-muted hover:text-ink ${
            settingsOpen ? "bg-surface-3 text-ink" : "bg-surface-2"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {settingsOpen ? (
        <SettingsPanel current={settings} onApply={applySettings} onCancel={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}

function SettingsPanel({
  current,
  onApply,
  onCancel,
}: {
  current: Settings;
  onApply: (s: Settings) => void;
  onCancel: () => void;
}) {
  const [focus, setFocus] = React.useState(String(current.focusMinutes));
  const [shortBreak, setShortBreak] = React.useState(String(current.shortBreakMinutes));
  const [longBreak, setLongBreak] = React.useState(String(current.longBreakMinutes));

  function handleApply() {
    onApply({
      focusMinutes: clampMinutes(focus, current.focusMinutes),
      shortBreakMinutes: clampMinutes(shortBreak, current.shortBreakMinutes),
      longBreakMinutes: clampMinutes(longBreak, current.longBreakMinutes),
    });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApply();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="mt-6 w-[280px] border border-default bg-surface p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Durations
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <Row label="Focus" value={focus} onChange={setFocus} onKey={onKey} />
        <Row label="Short break" value={shortBreak} onChange={setShortBreak} onKey={onKey} />
        <Row label="Long break" value={longBreak} onChange={setLongBreak} onKey={onKey} />
      </div>
      <button
        type="button"
        onClick={handleApply}
        className="glow-on-hover mt-4 inline-flex h-9 w-full items-center justify-center gap-2 border border-default bg-surface-2 text-sm font-semibold text-ink"
      >
        <Check className="h-4 w-4" strokeWidth={2} /> Apply
      </button>
    </div>
  );
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
