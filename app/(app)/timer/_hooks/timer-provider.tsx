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
  intervalOverrunSeconds,
  isBreakKind,
  liveElapsedMs,
  nextRoundExtension,
  type PlannedInterval,
  type TimerConfig,
} from "@/lib/timer-math";

import {
  advanceInterval,
  appendFlowRound,
  discardSession,
  endSession,
  extendCurrentInterval,
  heartbeat,
  pauseSession,
  resumeSession,
  setReturnNote as setReturnNoteAction,
  startSession,
} from "../actions";
import type { HydratedSession } from "../_lib/session-hydrate";
import { useReturnNotification } from "./use-return-notification";

export type TimerSettings = {
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartNextFocus: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  returnAlertsEnabled: boolean;
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
  /**
   * Seconds of break time already consumed by closed intervals.
   *
   * Banked on every ADVANCE that leaves a break, so the session's wall clock
   * can be reduced to active time exactly the way the server's
   * `loggedElapsedSeconds` does at endSession. Without it a long break would
   * count against "logged today" and eat the remaining countdown — which is
   * how the second focus block of a pomodoro used to read as 0:00.
   */
  closedBreakSeconds: number;
  sessionId: string | null;
  clientKey: string;
  config: TimerConfig;
  task: TimerTask;
  reachedTarget: boolean;
  /**
   * `Date.now()` when the current break was announced as overrunning, or null.
   *
   * A flag, not a measurement. The overrun *number* is derived from the
   * interval clock like everything else here; this only records that the chime
   * has already been spent, so it can't fire four times a second.
   */
  overrunSince: number | null;
  /**
   * `Date.now()` when the current Pomodoro Flow focus block crossed its
   * baseline, or null. Gates the gentle baseline chime so it fires once per
   * focus block (and never replays on a reload).
   */
  focusFlowSince: number | null;
  /**
   * Seconds flowed past the baseline across focus blocks already closed in
   * this session. Added to the active block's live flow seconds for summaries.
   */
  bankedFlowSeconds: number;
  /**
   * Seconds deliberately added to the current interval by pressing "5 more".
   *
   * Kept apart from the plan because the plan is derived from the config, and a
   * chosen extension is a fact about *this* break rather than a change to how
   * breaks work. Keeping it separate is also what lets /stats tell an extension
   * apart from an overrun — they are different events and averaging them
   * together makes the number meaningless.
   */
  intervalExtraSeconds: number;
  /**
   * What you were in the middle of when this break started.
   *
   * Mirrors `SessionInterval.returnNote`. Held here as well so the break screen
   * and the badge can show it without a round trip — it is a cue you need at
   * the moment you look up, not a value worth waiting on.
   */
  returnNote: string | null;
};

export type NextBreakInfo = {
  kind: "SHORT_BREAK" | "LONG_BREAK";
  seconds: number;
  /** True when taking this break appends a new break + focus round to the plan. */
  appendsRound: boolean;
};

type Action =
  | { type: "CONFIGURE"; config: Partial<TimerConfig>; task?: TimerTask }
  | { type: "START"; at: number }
  | { type: "ATTACH"; sessionId: string }
  | { type: "PAUSE"; at: number }
  | { type: "RESUME"; at: number }
  | { type: "REACH_TARGET" }
  | { type: "ENTER_FLOW"; at: number }
  | { type: "OVERRUN"; at: number }
  | { type: "EXTEND"; seconds: number }
  | { type: "SET_RETURN_NOTE"; note: string | null }
  | { type: "ADVANCE"; at: number; nextIndex: number; resume?: boolean }
  | {
      type: "APPEND_ROUND_AND_ADVANCE";
      at: number;
      intervals: number;
      targetSeconds: number;
      nextIndex: number;
    }
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
        closedBreakSeconds: 0,
        reachedTarget: false,
        overrunSince: null,
        focusFlowSince: null,
        bankedFlowSeconds: 0,
        intervalExtraSeconds: 0,
        returnNote: null,
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

    case "ENTER_FLOW":
      return state.focusFlowSince !== null
        ? state
        : { ...state, focusFlowSince: action.at };

    case "OVERRUN":
      return state.overrunSince !== null
        ? state
        : { ...state, overrunSince: action.at };

    case "EXTEND":
      // Taking more time on purpose ends the overrun: you are back inside a
      // break you chose the length of, not still losing one.
      return {
        ...state,
        intervalExtraSeconds: state.intervalExtraSeconds + action.seconds,
        overrunSince: null,
      };

    case "SET_RETURN_NOTE":
      return { ...state, returnNote: action.note };

    case "ADVANCE": {
      const elapsed = liveElapsedMs(
        { accumulatedMs: state.accumulatedMs, runningSince: state.runningSince },
        action.at,
      );

      // The interval being left behind, resolved from the plan so there is one
      // source of truth for what kind it was. A break closes with its full
      // actual duration — overrun included — because every second of it is
      // break time, whether or not it was claimed by "5 more minutes".
      const leaving = buildIntervalPlan(state.config)[state.intervalIndex];
      const leavingElapsed = Math.max(
        0,
        Math.round((elapsed - state.intervalBaseMs) / 1000),
      );
      const closedBreak =
        leaving && isBreakKind(leaving.kind) ? leavingElapsed : 0;
      const closedFlow =
        leaving && leaving.kind === "FOCUS" && leaving.targetSeconds > 0
          ? Math.max(0, leavingElapsed - (leaving.targetSeconds + state.intervalExtraSeconds))
          : 0;
      const shouldRun = state.phase === "RUNNING" || action.resume === true;

      return {
        ...state,
        phase: shouldRun ? "RUNNING" : state.phase,
        intervalIndex: action.nextIndex,
        intervalBaseMs: elapsed,
        accumulatedMs: elapsed,
        closedBreakSeconds: state.closedBreakSeconds + closedBreak,
        bankedFlowSeconds: state.bankedFlowSeconds + closedFlow,
        runningSince: shouldRun ? action.at : null,
        // All four belong to the interval being left behind.
        overrunSince: null,
        focusFlowSince: null,
        intervalExtraSeconds: 0,
        returnNote: null,
      };
    }

    case "APPEND_ROUND_AND_ADVANCE": {
      const elapsed = liveElapsedMs(
        { accumulatedMs: state.accumulatedMs, runningSince: state.runningSince },
        action.at,
      );
      const leaving = buildIntervalPlan(state.config)[state.intervalIndex];
      const leavingElapsed = Math.max(
        0,
        Math.round((elapsed - state.intervalBaseMs) / 1000),
      );
      const closedFlow =
        leaving && leaving.kind === "FOCUS" && leaving.targetSeconds > 0
          ? Math.max(0, leavingElapsed - (leaving.targetSeconds + state.intervalExtraSeconds))
          : 0;

      return {
        ...state,
        phase: "RUNNING",
        config: {
          ...state.config,
          intervals: action.intervals,
          targetSeconds: action.targetSeconds,
        },
        intervalIndex: action.nextIndex,
        intervalBaseMs: elapsed,
        accumulatedMs: elapsed,
        bankedFlowSeconds: state.bankedFlowSeconds + closedFlow,
        runningSince: action.at,
        overrunSince: null,
        focusFlowSince: null,
        intervalExtraSeconds: 0,
        returnNote: null,
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
        closedBreakSeconds: 0,
        sessionId: null,
        clientKey: newClientKey(),
        config: action.config,
        task: action.task,
        reachedTarget: false,
        overrunSince: null,
        focusFlowSince: null,
        bankedFlowSeconds: 0,
        intervalExtraSeconds: 0,
        returnNote: null,
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
  /**
   * Active seconds, break time excluded — the client's mirror of what the
   * server logs at endSession. This is the number every "how much is logged"
   * surface should show; `elapsedSeconds` is the raw wall clock, which spans
   * breaks and only exists for the macro container.
   */
  focusElapsedSeconds: number;
  intervalElapsedSeconds: number;
  /** The current interval's target, including anything added by hand. */
  currentTargetSeconds: number;
  /** Whether the interval on the clock right now is a break. */
  onBreak: boolean;
  /** True when a Pomodoro Flow focus block has crossed its baseline and is flowing. */
  isFocusFlowing: boolean;
  /** Seconds flowed past the current focus block's baseline. 0 unless flowing. */
  focusFlowSeconds: number;
  /** Total flow seconds accrued across the session (banked + current block). */
  totalFlowSeconds: number;
  /** Next break reachable from the current focus block (scheduled or appended). */
  nextBreak: NextBreakInfo | null;
  /** Seconds this break has run past its time. 0 unless overrunning. */
  overrunSeconds: number;
  isOverrunning: boolean;
  extendInterval: (seconds: number) => void;
  setReturnNote: (note: string) => void;
  configure: (config: Partial<TimerConfig>, task?: TimerTask) => void;
  reset: (config: TimerConfig, task: TimerTask) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  takeBreak: () => void;
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
      shortBreakSeconds: state.config.shortBreakSeconds,
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
    dispatch({ type: "ADVANCE", at: Date.now(), nextIndex, resume: true });
    if (state.sessionId) {
      void advanceInterval(state.sessionId, nextIndex, true, { resume: true });
    }
  }, [plan.length, state.intervalIndex, state.sessionId, stop]);

  const toggle = useCallback(() => {
    if (state.phase === "RUNNING") pause();
    else if (state.phase === "PAUSED") resume();
    else start();
  }, [pause, resume, start, state.phase]);

  /**
   * Take more break, on purpose.
   *
   * The server has to hear about it too: `closeOpenIntervalOps` computes the
   * interval's overtime against its stored target, so without this the minutes
   * you deliberately claimed would be logged as minutes you lost.
   */
  const extendInterval = useCallback(
    (seconds: number) => {
      dispatch({ type: "EXTEND", seconds });
      if (state.sessionId) void extendCurrentInterval(state.sessionId, seconds);
    },
    [state.sessionId],
  );

  const setReturnNote = useCallback(
    (note: string) => {
      const trimmed = note.trim();
      dispatch({ type: "SET_RETURN_NOTE", note: trimmed === "" ? null : trimmed });
      if (state.sessionId) void setReturnNoteAction(state.sessionId, note);
    },
    [state.sessionId],
  );

  // ---- interval / target boundaries --------------------------------------

  const recovery = state.config.mode === "RECOVERY";
  const current = plan[Math.min(state.intervalIndex, plan.length - 1)];

  const onBreak = current !== undefined && isBreakKind(current.kind);

  // The wall clock runs straight through breaks, so it counts the coffee as
  // work — the same problem the server's `loggedElapsedSeconds` solves at
  // endSession. Mirror it here: closed breaks are banked in state as they
  // close, and the break on the clock right now is subtracted live because it
  // has not closed yet. Sessions with no breaks reduce to exactly the old
  // number, the same rule that keeps old logged rows reading as they always
  // did.
  const focusElapsedSeconds = Math.max(
    0,
    elapsedSeconds -
      state.closedBreakSeconds -
      (onBreak ? intervalElapsedSeconds : 0),
  );

  // What the current interval is actually aiming at, once anything added by
  // hand is counted. Zero stays zero: recovery has no target and adding to it
  // would invent one.
  const currentTargetSeconds =
    current && current.targetSeconds > 0
      ? current.targetSeconds + state.intervalExtraSeconds
      : 0;

  // The `!recovery` and `targetSeconds > 0` clauses are not belt-and-braces:
  // recovery's single interval has a target of zero, so without them
  // `intervalElapsedSeconds >= 0` is true on the very first render and the
  // session ends the instant it starts.
  const intervalDone =
    isRunning &&
    !recovery &&
    current &&
    currentTargetSeconds > 0 &&
    intervalElapsedSeconds >= currentTargetSeconds;

  /**
   * Pomodoro Flow past its focus baseline. Stays true while paused too so a
   * brief interruption mid-flow doesn't hide that you already met the baseline.
   */
  const isFocusFlowing =
    state.config.mode === "FLOW" &&
    !onBreak &&
    (state.phase === "RUNNING" || state.phase === "PAUSED") &&
    currentTargetSeconds > 0 &&
    intervalElapsedSeconds >= currentTargetSeconds;

  const focusFlowSeconds = isFocusFlowing
    ? Math.max(0, intervalElapsedSeconds - currentTargetSeconds)
    : 0;

  const totalFlowSeconds = state.bankedFlowSeconds + focusFlowSeconds;

  const nextBreak = useMemo<NextBreakInfo | null>(() => {
    if (onBreak || recovery || state.config.mode === "BASIC") return null;

    const upcoming = plan[state.intervalIndex + 1];
    if (upcoming && isBreakKind(upcoming.kind)) {
      return {
        kind: upcoming.kind as "SHORT_BREAK" | "LONG_BREAK",
        seconds: upcoming.targetSeconds,
        appendsRound: false,
      };
    }

    if (state.config.mode === "FLOW") {
      const extension = nextRoundExtension(state.config);
      if (extension) {
        return {
          kind: extension.breakKind,
          seconds: extension.breakSeconds,
          appendsRound: true,
        };
      }
    }

    return null;
  }, [onBreak, plan, recovery, state.config, state.intervalIndex]);

  const takeBreak = useCallback(() => {
    if (!nextBreak) return;

    const nextIndex = state.intervalIndex + 1;
    if (nextBreak.appendsRound) {
      const extension = nextRoundExtension(state.config);
      if (!extension) return;
      dispatch({
        type: "APPEND_ROUND_AND_ADVANCE",
        at: Date.now(),
        intervals: extension.intervals,
        targetSeconds: extension.targetSeconds,
        nextIndex,
      });
      if (state.sessionId) void appendFlowRound(state.sessionId);
      return;
    }

    dispatch({ type: "ADVANCE", at: Date.now(), nextIndex, resume: true });
    if (state.sessionId) {
      void advanceInterval(state.sessionId, nextIndex, true, { resume: true });
    }
  }, [nextBreak, state.config, state.intervalIndex, state.sessionId]);

  /**
   * A break that is past its time and still on the clock.
   *
   * Derived, never counted — same rule as every other number here, so a
   * throttled tab or a sleeping laptop resumes at the truthful value instead of
   * at wherever a tick loop got to.
   */
  const overrunSeconds =
    onBreak && isRunning
      ? intervalOverrunSeconds(intervalElapsedSeconds, currentTargetSeconds)
      : 0;

  const isOverrunning = overrunSeconds > 0;

  // Same trap: `elapsedSeconds >= 0` is always true, so an unguarded
  // targetReached would chime at t=0 on a session that had no target.
  //
  // Measured against focus time, not the wall clock: a break that ran over
  // must not ring "you reached your goal" — the goal is the work, and the work
  // is what `focusElapsedSeconds` counts.
  const targetReached =
    !recovery && focusElapsedSeconds >= state.config.targetSeconds;

  useEffect(() => {
    if (!isRunning || !targetReached || state.reachedTarget) return;
    dispatch({ type: "REACH_TARGET" });
    // Pomodoro Flow plays its own gentle baseline chime on each focus block;
    // skipping here prevents a double chime on a single-round flow session.
    if (settings.soundEnabled && state.config.mode !== "FLOW") void chime();
  }, [
    isRunning,
    settings.soundEnabled,
    state.config.mode,
    state.reachedTarget,
    targetReached,
  ]);

  /**
   * Pomodoro Flow crossing a focus block's baseline: announce gently once per
   * focus block, then stay completely out of the way so flow continues.
   */
  useEffect(() => {
    if (!intervalDone || onBreak || state.config.mode !== "FLOW") return;
    if (state.focusFlowSince !== null) return;

    dispatch({ type: "ENTER_FLOW", at: Date.now() });
    if (settings.soundEnabled) void flowChime();
    if (settings.hapticsEnabled) navigator.vibrate?.(FLOW_PATTERN);
  }, [
    intervalDone,
    onBreak,
    settings.hapticsEnabled,
    settings.soundEnabled,
    state.config.mode,
    state.focusFlowSince,
  ]);

  /**
   * A break running out is the moment this app was previously silent for.
   *
   * It used to advance to the next focus interval and immediately pause. A
   * paused clock accumulates nothing, so the five minutes that became forty
   * were not merely unannounced — they were never recorded, and afterwards
   * there was no evidence they had happened.
   *
   * Now the break simply stays on the clock and overruns. Nothing auto-starts:
   * the rule that an unattended break must not quietly become focus time still
   * holds, and holds harder, because the overrun accrues against the *break*
   * and is credited to no task at all.
   */
  useEffect(() => {
    if (!intervalDone || !onBreak) return;
    if (state.overrunSince !== null) return;

    dispatch({ type: "OVERRUN", at: Date.now() });

    // The boundary had no signal of any kind before this: the chime fires once
    // per session, at the overall target, which a break end never is.
    if (settings.soundEnabled) void chime();
    if (settings.hapticsEnabled) navigator.vibrate?.(OVERRUN_PATTERN);
  }, [
    intervalDone,
    onBreak,
    settings.hapticsEnabled,
    settings.soundEnabled,
    state.overrunSince,
  ]);

  useEffect(() => {
    if (!intervalDone) return;

    // Breaks are handled above: they overrun in place rather than advancing.
    if (onBreak) return;

    // FLOW (Pomodoro Flow) never ends on its own — continuing past the
    // baseline is the whole point. RECOVERY doesn't either, for the opposite
    // reason. One predicate rather than two literals, so the next mode added
    // can't forget a call site.
    if (!endsAutomatically(state.config.mode)) return;

    const nextIndex = state.intervalIndex + 1;

    if (nextIndex >= plan.length) {
      dispatch({ type: "END", at: Date.now() });
      if (state.sessionId) {
        void endSession(state.sessionId, { reason: "TARGET_REACHED" });
      }
      return;
    }

    if (settings.soundEnabled) void chime();

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
    onBreak,
    plan,
    settings.autoStartBreaks,
    settings.autoStartNextFocus,
    settings.soundEnabled,
    state.config.mode,
    state.intervalIndex,
    state.sessionId,
  ]);

  // Mounted here rather than on the timer screen on purpose. The provider is in
  // both route layouts, so this keeps saying something after you have navigated
  // away — and navigating away is most of what an overrunning break *is*.
  useReturnNotification({
    enabled: settings.returnAlertsEnabled,
    overrunning: isOverrunning,
    onBreak: onBreak && isRunning,
    overrunSeconds,
    returnNote: state.returnNote,
  });

  const value = useMemo<TimerContextValue>(
    () => ({
      state,
      plan,
      elapsedMs,
      elapsedSeconds,
      focusElapsedSeconds,
      intervalElapsedSeconds,
      currentTargetSeconds,
      onBreak,
      isFocusFlowing,
      focusFlowSeconds,
      totalFlowSeconds,
      nextBreak,
      overrunSeconds,
      isOverrunning,
      extendInterval,
      setReturnNote,
      configure,
      reset,
      start,
      pause,
      resume,
      toggle,
      takeBreak,
      skipInterval,
      stop,
      discard,
      settings,
    }),
    [
      configure,
      currentTargetSeconds,
      discard,
      elapsedMs,
      elapsedSeconds,
      extendInterval,
      focusElapsedSeconds,
      focusFlowSeconds,
      intervalElapsedSeconds,
      isFocusFlowing,
      isOverrunning,
      nextBreak,
      onBreak,
      overrunSeconds,
      pause,
      plan,
      reset,
      resume,
      setReturnNote,
      settings,
      skipInterval,
      start,
      state,
      stop,
      takeBreak,
      toggle,
      totalFlowSeconds,
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
      closedBreakSeconds: 0,
      sessionId: null,
      clientKey: newClientKey(),
      config,
      task: null,
      reachedTarget: false,
      overrunSince: null,
      focusFlowSince: null,
      bankedFlowSeconds: 0,
      intervalExtraSeconds: 0,
      returnNote: null,
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
    closedBreakSeconds: initialSession.breakElapsedSeconds,
    sessionId: initialSession.id,
    clientKey: initialSession.clientKey,
    config: initialSession.config,
    task: initialSession.task,
    reachedTarget: initialSession.reachedTarget,
    // Null rather than a reconstructed timestamp: this only gates the chime,
    // and a reload should not replay a boundary you already heard. The overrun
    // *number* rehydrates for free, because it is derived from the clock.
    overrunSince: null,
    focusFlowSince: initialSession.intervalAlreadyFlowing ? Date.now() : null,
    bankedFlowSeconds: initialSession.bankedFlowSeconds,
    intervalExtraSeconds: initialSession.intervalExtraSeconds,
    returnNote: initialSession.returnNote,
  };
}

/**
 * Two firm pulses. Deliberately unlike the 50%/10% nudges in
 * `use-threshold-haptics`, which are single taps you are meant to be able to
 * ignore — this one is telling you the break is over.
 */
const OVERRUN_PATTERN = [60, 80, 60];

/** One soft pulse for Pomodoro Flow crossing the baseline — never an alarm. */
const FLOW_PATTERN = [35];

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

/**
 * A gentler, warmer harmonic nudge for Pomodoro Flow's baseline: softer gain
 * and a relaxed rising fifth so it lands cleanly without pulling you out of
 * concentration.
 */
async function flowChime() {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") await audioContext.resume();

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    gain.connect(audioContext.destination);

    for (const [frequency, delay] of [
      [528, 0],
      [792, 0.16],
    ] as const) {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 1.15);
    }
  } catch {
    // Audio is a nicety; a blocked AudioContext must never break the timer.
  }
}
