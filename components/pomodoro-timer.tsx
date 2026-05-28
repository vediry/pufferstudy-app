"use client";

import * as React from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";

const STORAGE_KEY = "pufferstudy.pomodoro";

type Phase = "focus" | "shortBreak" | "longBreak";

const PHASE_DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

type PomodoroState = {
  phase: Phase;
  running: boolean;
  endTime: number | null;
  remainingSeconds: number;
  completedFocusBlocks: number;
};

function defaultState(): PomodoroState {
  return {
    phase: "focus",
    running: false,
    endTime: null,
    remainingSeconds: PHASE_DURATIONS.focus,
    completedFocusBlocks: 0,
  };
}

function loadState(): PomodoroState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!["focus", "shortBreak", "longBreak"].includes(parsed.phase)) return defaultState();
    return parsed as PomodoroState;
  } catch {
    return defaultState();
  }
}

function pickNextPhase(state: PomodoroState): Phase {
  if (state.phase === "focus") {
    return state.completedFocusBlocks + 1 >= 4 ? "longBreak" : "shortBreak";
  }
  return "focus";
}

function nextCompletedBlocks(state: PomodoroState): number {
  if (state.phase !== "focus") return state.completedFocusBlocks;
  return state.completedFocusBlocks + 1 >= 4 ? 0 : state.completedFocusBlocks + 1;
}

export function PomodoroTimer() {
  const [state, setState] = React.useState<PomodoroState>(defaultState);
  const [, forceTick] = React.useState(0);
  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    setState(loadState());
    hydratedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

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
        remainingSeconds: PHASE_DURATIONS[nxt],
        completedFocusBlocks: nextCompletedBlocks(state),
      });
    }
  }, [displaySeconds, state]);

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
      remainingSeconds: PHASE_DURATIONS[prev.phase],
    }));
  }

  function skip() {
    setState((prev) => {
      const nxt = pickNextPhase(prev);
      return {
        phase: nxt,
        running: false,
        endTime: null,
        remainingSeconds: PHASE_DURATIONS[nxt],
        completedFocusBlocks: nextCompletedBlocks(prev),
      };
    });
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
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      <div className="mt-6 flex items-center gap-2" aria-label={`${state.completedFocusBlocks} of 4 focus blocks completed`}>
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
      </div>
    </div>
  );
}
