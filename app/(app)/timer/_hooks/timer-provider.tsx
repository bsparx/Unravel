"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  buildIntervalPlan,
  endsAutomatically,
  liveElapsedMs,
  type PlannedInterval,
  type TimerConfig,
} from "@/lib/timer-math";

import {
  advanceInterval,
  discardSession,
  endSession,
  heartbeat,
  pauseSession,
  resumeSession,
  startSession,
} from "../actions";
import type { HydratedSession } from "../_lib/session-hydrate";

export type TimerSettings = {
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartNextFocus: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

export type TimerTask = {
  id: string;
  title: string;
  type: "TODO" | "HABIT";
} | null;

export type TimerPhase = "IDLE" | "RUNNING" | "PAUSED" | "ENDED";

type TimerState = {
  phase: TimerPhase;
  /** `Date.now()` at the last resume, or null when the clock is frozen. */
  runningSince: number | null;
  /** Frozen active milliseconds from every prior run segment. */
  accumulatedMs: number;
  intervalIndex: number;
  /** Milliseconds already spent inside the current interval. */
  intervalBaseMs: number;
  sessionId: string | null;
  clientKey: string;
  config: TimerConfig;
  task: TimerTask;
  reachedTarget: boolean;
};

type Action =
  | { type: "CONFIGURE"; config: Partial<TimerConfig>; task?: TimerTask }
  | { type: "START"; at: number }
  | { type: "ATTACH"; sessionId: string }
  | { type: "PAUSE"; at: number }
  | { type: "RESUME"; at: number }
  | { type: "REACH_TARGET" }
  | { type: "ADVANCE"; at: number; nextIndex: number }
  | { type: "END"; at: number }
  | { type: "RESET"; config: TimerConfig; task: TimerTask }
  | { type: "HYDRATE"; state: TimerState };

function newClientKey() {
  return globalThis.crypto?.randomUUID?.() ?? `k_${Date.now()}_${Math.random()}`;
}

function reducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case "CONFIGURE":
      // Reconfiguring a live session would make the logged plan a lie.
      if (state.phase !== "IDLE") return state;
      return {
        ...state,
        config: { ...state.config, ...action.config },
        task: action.task === undefined ? state.task : action.task,
      };

    case "START":
      if (state.phase !== "IDLE" && state.phase !== "ENDED") return state;
      return {
        ...state,
        phase: "RUNNING",
        runningSince: action.at,
        accumulatedMs: 0,
        intervalIndex: 0,
        intervalBaseMs: 0,
        reachedTarget: false,
        clientKey: state.phase === "ENDED" ? newClientKey() : state.clientKey,
        sessionId: null,
      };

    case "ATTACH":
      return { ...state, sessionId: action.sessionId };

    case "PAUSE": {
      if (state.phase !== "RUNNING") return state;
      const elapsed = liveElapsedMs(
        { accumulatedMs: state.accumulatedMs, runningSince: state.runningSince },
        action.at,
      );
      return { ...state, phase: "PAUSED", accumulatedMs: elapsed, runningSince: null };
    }

    case "RESUME":
      if (state.phase !== "PAUSED") return state;
      return { ...state, phase: "RUNNING", runningSince: action.at };

    case "REACH_TARGET":
      return state.reachedTarget ? state : { ...state, reachedTarget: true };

    case "ADVANCE": {
      const elapsed = liveElapsedMs(
        { accumulatedMs: state.accumulatedMs, runningSince: state.runningSince },
        action.at,
      );
      return {
        ...state,
        intervalIndex: action.nextIndex,
        intervalBaseMs: elapsed,
        accumulatedMs: elapsed,
        runningSince: state.phase === "RUNNING" ? action.at : null,
      };
    }

    case "END": {
      const elapsed = liveElapsedMs(
        { accumulatedMs: state.accumulatedMs, runningSince: state.runningSince },
        action.at,
      );
      return { ...state, phase: "ENDED", accumulatedMs: elapsed, runningSince: null };
    }

    case "RESET":
      return {
        phase: "IDLE",
        runningSince: null,
        accumulatedMs: 0,
        intervalIndex: 0,
        intervalBaseMs: 0,
        sessionId: null,
        clientKey: newClientKey(),
        config: action.config,
        task: action.task,
        reachedTarget: false,
      };

    case "HYDRATE":
      return action.state;

    default:
      return state;
  }
}

type TimerContextValue = {
  state: TimerState;
  plan: PlannedInterval[];
  /** Re-renders ~4x a second while running; the number itself is derived. */
  elapsedMs: number;
  elapsedSeconds: number;
  intervalElapsedSeconds: number;
  configure: (config: Partial<TimerConfig>, task?: TimerTask) => void;
  reset: (config: TimerConfig, task: TimerTask) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  skipInterval: () => void;
  stop: (options?: { completedTask?: boolean }) => Promise<void>;
  discard: () => Promise<void>;
  settings: TimerSettings;
};

const TimerContext = createContext<TimerContextValue | null>(null);

const DEFAULT_CONFIG: TimerConfig = {
  mode: "POMODORO",
  targetSeconds: 1500,
  intervals: 1,
  focusSeconds: 1500,
  shortBreakSeconds: 300,
  longBreakSeconds: 900,
  longBreakEvery: 4,
};

export function TimerProvider({
  children,
  settings,
  initialSession,
}: {
  children: React.ReactNode;
  settings: TimerSettings;
  initialSession: HydratedSession | null;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    { settings, initialSession },
    initialState,
  );

  // Only forces a re-render; every displayed number is derived from Date.now().
  const [, forceTick] = useState(0);

  const plan = useMemo(() => buildIntervalPlan(state.config), [state.config]);

  const isRunning = state.phase === "RUNNING";

  useEffect(() => {
    if (!isRunning) return;

    const id = window.setInterval(() => forceTick((n) => n + 1), 250);

    // A throttled background tab can go a whole minute between intervals.
    // Recompute the instant it comes back so the number is never visibly stale.
    const onVisible = () => forceTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isRunning]);

  const elapsedMs = liveElapsedMs({
    accumulatedMs: state.accumulatedMs,
    runningSince: state.runningSince,
  });
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const intervalElapsedSeconds = Math.max(
    0,
    Math.floor((elapsedMs - state.intervalBaseMs) / 1000),
  );

  // ---- server sync -------------------------------------------------------

  // Mirrored into a ref so the `pagehide` handler always beacons the current
  // session without needing to be torn down and rebuilt on every change.
  const sessionIdRef = useRef<string | null>(state.sessionId);
  useEffect(() => {
    sessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  useEffect(() => {
    if (!isRunning || !state.sessionId) return;

    const id = window.setInterval(() => {
      void heartbeat(state.sessionId!);
    }, 60_000);

    return () => window.clearInterval(id);
  }, [isRunning, state.sessionId]);

  // A closing tab can't await a Server Action, so flush through a beacon.
  useEffect(() => {
    const onPageHide = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || !isRunning) return;
      navigator.sendBeacon?.(
        "/api/session-beacon",
        new Blob([JSON.stringify({ sessionId })], { type: "application/json" }),
      );
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [isRunning]);

  // ---- controls ----------------------------------------------------------

  const configure = useCallback(
    (config: Partial<TimerConfig>, task?: TimerTask) => {
      dispatch({ type: "CONFIGURE", config, task });
    },
    [],
  );

  const reset = useCallback((config: TimerConfig, task: TimerTask) => {
    dispatch({ type: "RESET", config, task });
  }, []);

  const start = useCallback(() => {
    const clientKey = state.phase === "ENDED" ? newClientKey() : state.clientKey;
    dispatch({ type: "START", at: Date.now() });

    void startSession({
      clientKey,
      taskId: state.task?.id ?? null,
      mode: state.config.mode,
      targetSeconds: state.config.targetSeconds,
      intervals: state.config.intervals,
    }).then((snapshot) => {
      if (snapshot) dispatch({ type: "ATTACH", sessionId: snapshot.id });
    });
  }, [state.clientKey, state.config, state.phase, state.task]);

  const pause = useCallback(() => {
    dispatch({ type: "PAUSE", at: Date.now() });
    if (state.sessionId) void pauseSession(state.sessionId);
  }, [state.sessionId]);

  const resume = useCallback(() => {
    dispatch({ type: "RESUME", at: Date.now() });
    if (state.sessionId) void resumeSession(state.sessionId);
  }, [state.sessionId]);

  const stop = useCallback(
    async (options?: { completedTask?: boolean }) => {
      dispatch({ type: "END", at: Date.now() });
      if (state.sessionId) {
        await endSession(state.sessionId, {
          completedTask: options?.completedTask,
          reason: options?.completedTask ? undefined : "USER_STOPPED",
        });
      }
    },
    [state.sessionId],
  );

  const discard = useCallback(async () => {
    const sessionId = state.sessionId;
    dispatch({ type: "RESET", config: state.config, task: state.task });
    if (sessionId) await discardSession(sessionId);
  }, [state.config, state.sessionId, state.task]);

  const skipInterval = useCallback(() => {
    const nextIndex = state.intervalIndex + 1;
    if (nextIndex >= plan.length) {
      void stop();
      return;
    }
    dispatch({ type: "ADVANCE", at: Date.now(), nextIndex });
    if (state.sessionId) void advanceInterval(state.sessionId, nextIndex, true);
  }, [plan.length, state.intervalIndex, state.sessionId, stop]);

  const toggle = useCallback(() => {
    if (state.phase === "RUNNING") pause();
    else if (state.phase === "PAUSED") resume();
    else start();
  }, [pause, resume, start, state.phase]);

  // ---- interval / target boundaries --------------------------------------

  const recovery = state.config.mode === "RECOVERY";
  const current = plan[Math.min(state.intervalIndex, plan.length - 1)];

  // The `!recovery` and `targetSeconds > 0` clauses are not belt-and-braces:
  // recovery's single interval has a target of zero, so without them
  // `intervalElapsedSeconds >= 0` is true on the very first render and the
  // session ends the instant it starts.
  const intervalDone =
    isRunning &&
    !recovery &&
    current &&
    current.targetSeconds > 0 &&
    intervalElapsedSeconds >= current.targetSeconds;

  // Same trap: `elapsedSeconds >= 0` is always true, so an unguarded
  // targetReached would chime at t=0 on a session that had no target.
  const targetReached =
    !recovery && elapsedSeconds >= state.config.targetSeconds;

  useEffect(() => {
    if (!isRunning || !targetReached || state.reachedTarget) return;
    dispatch({ type: "REACH_TARGET" });
    if (settings.soundEnabled) void chime();
  }, [isRunning, settings.soundEnabled, state.reachedTarget, targetReached]);

  useEffect(() => {
    if (!intervalDone) return;

    // FLOW never ends on its own — overrunning the goal is the whole feature.
    // RECOVERY doesn't either, for the opposite reason. One predicate rather
    // than two literals, so the next mode added can't forget a call site.
    if (!endsAutomatically(state.config.mode)) return;

    const nextIndex = state.intervalIndex + 1;

    if (nextIndex >= plan.length) {
      dispatch({ type: "END", at: Date.now() });
      if (state.sessionId) {
        void endSession(state.sessionId, { reason: "TARGET_REACHED" });
      }
      return;
    }

    const nextIsBreak = plan[nextIndex].kind !== "FOCUS";
    const autoStart = nextIsBreak
      ? settings.autoStartBreaks
      : settings.autoStartNextFocus;

    dispatch({ type: "ADVANCE", at: Date.now(), nextIndex });
    if (state.sessionId) void advanceInterval(state.sessionId, nextIndex, true);

    // Without auto-start the timer waits for a deliberate press, which is the
    // safer default: an unattended break shouldn't quietly become focus time.
    if (!autoStart) {
      dispatch({ type: "PAUSE", at: Date.now() });
      if (state.sessionId) void pauseSession(state.sessionId);
    }
  }, [
    intervalDone,
    plan,
    settings.autoStartBreaks,
    settings.autoStartNextFocus,
    state.config.mode,
    state.intervalIndex,
    state.sessionId,
  ]);

  const value = useMemo<TimerContextValue>(
    () => ({
      state,
      plan,
      elapsedMs,
      elapsedSeconds,
      intervalElapsedSeconds,
      configure,
      reset,
      start,
      pause,
      resume,
      toggle,
      skipInterval,
      stop,
      discard,
      settings,
    }),
    [
      configure,
      discard,
      elapsedMs,
      elapsedSeconds,
      intervalElapsedSeconds,
      pause,
      plan,
      reset,
      resume,
      settings,
      skipInterval,
      start,
      state,
      stop,
      toggle,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used inside <TimerProvider>.");
  }
  return context;
}

function initialState({
  settings,
  initialSession,
}: {
  settings: TimerSettings;
  initialSession: HydratedSession | null;
}): TimerState {
  const config: TimerConfig = {
    ...DEFAULT_CONFIG,
    focusSeconds: settings.focusSeconds,
    targetSeconds: settings.focusSeconds,
    shortBreakSeconds: settings.shortBreakSeconds,
    longBreakSeconds: settings.longBreakSeconds,
    longBreakEvery: settings.longBreakEvery,
  };

  if (!initialSession) {
    return {
      phase: "IDLE",
      runningSince: null,
      accumulatedMs: 0,
      intervalIndex: 0,
      intervalBaseMs: 0,
      sessionId: null,
      clientKey: newClientKey(),
      config,
      task: null,
      reachedTarget: false,
    };
  }

  // A session was already live on the server — adopt it rather than starting
  // a second one. The server's accumulated time is the floor.
  return {
    phase: initialSession.status === "RUNNING" ? "RUNNING" : "PAUSED",
    runningSince: initialSession.runningSince,
    accumulatedMs: initialSession.accumulatedSeconds * 1000,
    intervalIndex: initialSession.intervalIndex,
    intervalBaseMs: initialSession.intervalBaseSeconds * 1000,
    sessionId: initialSession.id,
    clientKey: initialSession.clientKey,
    config: initialSession.config,
    task: initialSession.task,
    reachedTarget: initialSession.reachedTarget,
  };
}

let audioContext: AudioContext | null = null;

/** A short, soft chime. Synthesised, so there's no asset to load or block on. */
async function chime() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") await audioContext.resume();

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    gain.connect(audioContext.destination);

    for (const [frequency, delay] of [
      [660, 0],
      [880, 0.12],
    ] as const) {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 1);
    }
  } catch {
    // Audio is a nicety; a blocked AudioContext must never break the timer.
  }
}
