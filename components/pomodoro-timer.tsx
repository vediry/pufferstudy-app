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
} from "lucide-react";

const STATE_KEY = "pufferstudy.pomodoro";
const SETTINGS_KEY = "pufferstudy.pomodoro-settings";

type Phase = "focus" | "shortBreak" | "longBreak";

type Settings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  glowColor: string;
  chimeEnabled: boolean;
  notificationsEnabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  glowColor: "#e8b14b",
  chimeEnabled: true,
  notificationsEnabled: false,
};

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

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      focusMinutes: clampMinutes(parsed.focusMinutes, DEFAULT_SETTINGS.focusMinutes),
      shortBreakMinutes: clampMinutes(parsed.shortBreakMinutes, DEFAULT_SETTINGS.shortBreakMinutes),
      longBreakMinutes: clampMinutes(parsed.longBreakMinutes, DEFAULT_SETTINGS.longBreakMinutes),
      glowColor:
        typeof parsed.glowColor === "string" && HEX_RE.test(parsed.glowColor)
          ? parsed.glowColor
          : DEFAULT_SETTINGS.glowColor,
      chimeEnabled:
        typeof parsed.chimeEnabled === "boolean" ? parsed.chimeEnabled : DEFAULT_SETTINGS.chimeEnabled,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : DEFAULT_SETTINGS.notificationsEnabled,
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

function fireNotification(endedPhase: Phase) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Don't bug the user if they're actively looking at the tab.
  if (document.visibilityState === "visible") return;
  const { title, body } = PHASE_END_MSG[endedPhase];
  try {
    new Notification(title, { body, tag: "pufferstudy-pomodoro" });
  } catch {
    /* notification blocked or unsupported */
  }
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
      if (settings.chimeEnabled) playChime();
      if (settings.notificationsEnabled) fireNotification(state.phase);
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

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
        {PHASE_LABELS[state.phase]}
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
            color: settings.glowColor,
            opacity: 0.08,
            gridArea: "1 / 1",
          }}
        >
          88:88
        </span>
        <span
          className="text-[5.5rem] sm:text-[8rem]"
          style={{
            color: settings.glowColor,
            gridArea: "1 / 1",
            textShadow: `0 0 4px ${settings.glowColor}, 0 0 12px ${settings.glowColor}, 0 0 26px ${settings.glowColor}, 0 0 50px ${settings.glowColor}`,
          }}
        >
          {timeStr}
        </span>
      </div>

      <div
        className="mt-6 flex items-center gap-2"
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
                  ? settings.glowColor
                  : "color-mix(in srgb, var(--ink-faint) 35%, transparent)",
                boxShadow: filled ? `0 0 4px ${settings.glowColor}` : undefined,
              }}
            />
          );
        })}
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
        <SettingsPanel
          settings={settings}
          onApplyDurations={applyDurations}
          onUpdateLive={updateLive}
          onCancel={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SettingsPanel({
  settings,
  onApplyDurations,
  onUpdateLive,
  onCancel,
}: {
  settings: Settings;
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
      <SectionLabel>Durations</SectionLabel>
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
      <div className="mt-2 flex items-center gap-2">
        {GLOW_SWATCHES.map((s) => {
          const active = settings.glowColor.toLowerCase() === s.value.toLowerCase();
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onUpdateLive({ glowColor: s.value })}
              aria-label={`Glow color: ${s.name}`}
              title={s.name}
              className="h-6 w-6 rounded-full border transition-shadow"
              style={{
                background: s.value,
                borderColor: active
                  ? "var(--ink)"
                  : "color-mix(in srgb, var(--border) 60%, transparent)",
                boxShadow: active ? `0 0 6px ${s.value}, 0 0 14px ${s.value}` : undefined,
              }}
            />
          );
        })}
        <label
          className="relative ml-1 inline-block h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-default"
          title="Custom color"
          aria-label="Custom glow color"
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
            value={settings.glowColor}
            onChange={(e) => onUpdateLive({ glowColor: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      <Divider />

      <SectionLabel>Sound &amp; alerts</SectionLabel>
      <div className="mt-2 flex flex-col gap-2.5">
        <Toggle
          label="Chime when phase ends"
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
