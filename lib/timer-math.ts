/**
 * Timer logic — pure functions, no React, no Prisma.
 *
 * The one rule that makes the timer trustworthy: **elapsed time is always
 * computed from wall-clock deltas, never accumulated by ticking.** A background
 * tab throttled to 1Hz, a laptop asleep for an hour, a dropped frame — none of
 * them can drift the number, because the number is derived, not counted.
 */

/** The three shapes a *work* session can take. */
export type WorkMode = "POMODORO" | "BASIC" | "FLOW";

/**
 * Recovery is not a fourth work shape — it is the peer of all three.
 * The top-level choice a person makes is work or recovery; picking pomodoro
 * over flow is a detail *inside* work.
 */
export type TimerMode = WorkMode | "RECOVERY";

export type SessionKind = "WORK" | "RECOVERY";

export const WORK_MODES = ["POMODORO", "BASIC", "FLOW"] as const;

export type IntervalKind =
  | "FOCUS"
  | "SHORT_BREAK"
  | "LONG_BREAK"
  | "RECOVERY";

export type PlannedInterval = {
  index: number;
  kind: IntervalKind;
  targetSeconds: number;
};

export type TimerConfig = {
  mode: TimerMode;
  /** Total planned focus seconds. In FLOW this is a soft goal, not a limit. */
  targetSeconds: number;
  /** Number of focus blocks. Always 1 for BASIC and FLOW. */
  intervals: number;
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
};

export const MIN_TARGET_SECONDS = 60;
export const MAX_TARGET_SECONDS = 8 * 60 * 60;
export const MAX_INTERVALS = 12;

export const DEFAULTS = {
  targetSeconds: 25 * 60,
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
  longBreakEvery: 4,
} as const;

export function clampTarget(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULTS.targetSeconds;
  return Math.min(MAX_TARGET_SECONDS, Math.max(MIN_TARGET_SECONDS, Math.round(seconds)));
}

export function clampIntervals(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(MAX_INTERVALS, Math.max(1, Math.round(count)));
}

/**
 * How many pomodoros a block of time naturally splits into.
 * 20 min at a 25 min pomodoro is one session, not zero.
 */
export function suggestIntervals(
  targetSeconds: number,
  focusSeconds: number,
): number {
  if (focusSeconds <= 0) return 1;
  return clampIntervals(Math.round(targetSeconds / focusSeconds) || 1);
}

/**
 * Expand a config into the ordered list of intervals the session will run.
 *
 * POMODORO splits the target into `intervals` equal focus blocks with breaks
 * between them (a long break every `longBreakEvery`). There is deliberately no
 * trailing break — the session ends on focus, so "done" means done.
 *
 * BASIC and FLOW are a single focus block.
 */
export function buildIntervalPlan(config: TimerConfig): PlannedInterval[] {
  // Recovery is one open-ended block with no target at all.
  //
  // `targetSeconds: 0` is the honest value — there is nothing to reach — and
  // it is load-bearing: it makes arcProgress, overtimeProgress and
  // intervalTickFractions all return empty without any of them needing to
  // know what recovery is. Anything that *counts down*, though, must guard on
  // the mode rather than on the zero. See the guards in timer-provider and
  // timer/actions.
  if (config.mode === "RECOVERY") {
    return [{ index: 0, kind: "RECOVERY", targetSeconds: 0 }];
  }

  if (config.mode !== "POMODORO") {
    return [{ index: 0, kind: "FOCUS", targetSeconds: config.targetSeconds }];
  }

  const count = clampIntervals(config.intervals);
  const perFocus = Math.max(
    MIN_TARGET_SECONDS,
    Math.round(config.targetSeconds / count),
  );

  const plan: PlannedInterval[] = [];
  let focusesSoFar = 0;

  for (let i = 0; i < count; i += 1) {
    plan.push({ index: plan.length, kind: "FOCUS", targetSeconds: perFocus });
    focusesSoFar += 1;

    const isLast = i === count - 1;
    if (isLast) break;

    const isLongBreak =
      config.longBreakEvery > 0 && focusesSoFar % config.longBreakEvery === 0;

    plan.push({
      index: plan.length,
      kind: isLongBreak ? "LONG_BREAK" : "SHORT_BREAK",
      targetSeconds: isLongBreak
        ? config.longBreakSeconds
        : config.shortBreakSeconds,
    });
  }

  return plan;
}

/** Total wall time a plan occupies, focus plus breaks. */
export function planTotalSeconds(plan: PlannedInterval[]): number {
  return plan.reduce((sum, interval) => sum + interval.targetSeconds, 0);
}

export function planFocusSeconds(plan: PlannedInterval[]): number {
  return plan
    .filter((interval) => interval.kind === "FOCUS")
    .reduce((sum, interval) => sum + interval.targetSeconds, 0);
}

// ---------------------------------------------------------------- live clock

export type ClockState = {
  /** Frozen active milliseconds from every prior run segment. */
  accumulatedMs: number;
  /** `Date.now()` at the last resume, or null when not running. */
  runningSince: number | null;
};

/**
 * Milliseconds of active time, right now.
 *
 * `Date.now()` and not `performance.now()`, deliberately: performance.now()
 * stops advancing while the machine is suspended, which would under-count a
 * timer left running over a lunch break.
 */
export function liveElapsedMs(state: ClockState, now: number = Date.now()): number {
  const live = state.runningSince === null ? 0 : Math.max(0, now - state.runningSince);
  return Math.max(0, state.accumulatedMs + live);
}

export function liveElapsedSeconds(state: ClockState, now?: number): number {
  return Math.floor(liveElapsedMs(state, now) / 1000);
}

/**
 * How full the arc is drawn, 0..1.
 *
 * FOCUS/BASIC/POMODORO deplete from 1 to 0 as time is spent — the ring drains
 * like sand, which is the whole point of a Time Timer.
 *
 * The `targetSeconds <= 0` guard is not defensive noise: a recovery session
 * has a target of zero, and this is what keeps it from rendering as a full
 * ring. Do not "simplify" it away.
 */
export function arcProgress(elapsedSeconds: number, targetSeconds: number): number {
  if (targetSeconds <= 0) return 0;
  const remaining = 1 - elapsedSeconds / targetSeconds;
  return Math.min(1, Math.max(0, remaining));
}

/**
 * The most time a single session may claim, once corrected by hand.
 *
 * Wider than `MAX_TARGET_SECONDS` on purpose. That constant caps what you can
 * *plan*; this caps what you can *claim you did*, and a long session that
 * genuinely overran is exactly the thing being corrected here. A day is the
 * ceiling because past it the number has stopped meaning anything.
 */
export const MAX_LOGGED_SECONDS = 24 * 60 * 60;

/**
 * A hand-entered duration, made safe to write.
 *
 * Zero is allowed and is not the same as refusing the edit: "this session
 * didn't happen" is a thing people need to be able to say about a timer they
 * left running, and it is better said by zeroing the row than by deleting it,
 * which would also delete the fact that the mistake was made.
 */
export function clampLoggedSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(MAX_LOGGED_SECONDS, Math.max(0, Math.round(seconds)));
}

/**
 * Overtime, recomputed after a correction.
 *
 * Overtime is a *subset* of elapsed time, so it can never survive its parent
 * being cut — a 17-hour session corrected to 5 minutes has no overtime left,
 * and leaving the old figure behind would make /stats report more time past
 * the goal than was logged at all. The recovery guard is the same one
 * `endSession` applies: rest has no target to overrun.
 */
export function adjustedOvertime(
  mode: TimerMode,
  loggedSeconds: number,
  targetSeconds: number,
): number {
  if (mode === "RECOVERY" || targetSeconds <= 0) return 0;
  return Math.max(0, clampLoggedSeconds(loggedSeconds) - targetSeconds);
}

/** A break is a gap *inside* work. Recovery is not a break — it is the work. */
export const isBreakKind = (kind: IntervalKind): boolean =>
  kind === "SHORT_BREAK" || kind === "LONG_BREAK";

/** One interval's resolved duration, however the caller worked it out. */
export type IntervalSpan = { kind: IntervalKind; seconds: number };

/**
 * The session's wall clock, minus every break inside it.
 *
 * `FocusSession.accumulatedSeconds` runs straight through breaks — only the
 * *interval* base moves when the plan advances — so the raw wall clock counts
 * the coffee as work. That figure becomes `elapsedSeconds`, which rolls up into
 * `TaskOccurrence.loggedSeconds`, habit quota, tier and streaks. So a pomodoro
 * with three breaks in it has been quietly inflating every number downstream
 * of it.
 *
 * Subtracting the breaks, rather than summing the focus intervals, is
 * deliberate. A focus interval only gets its `elapsedSeconds` written when it
 * closes, so summing them would read 0 for the interval that was open at the
 * moment Stop was pressed — which is every session's last one. Subtraction
 * needs no such bookkeeping, and on a session with no breaks at all it reduces
 * to exactly the old behaviour, which is what keeps sessions written before
 * this existed reading the same as they always did.
 */
export function loggedElapsedSeconds(
  wallClockSeconds: number,
  intervals: IntervalSpan[],
): number {
  const breaks = intervals.reduce(
    (total, interval) =>
      isBreakKind(interval.kind)
        ? total + Math.max(0, Math.round(interval.seconds))
        : total,
    0,
  );

  return Math.max(0, Math.round(wallClockSeconds) - breaks);
}

/**
 * How far past its own target one interval has run.
 *
 * The `targetSeconds <= 0` guard is the same one every other function here
 * carries: recovery has no target, so it can never be overrunning.
 */
export function intervalOverrunSeconds(
  intervalElapsedSeconds: number,
  targetSeconds: number,
): number {
  if (targetSeconds <= 0) return 0;
  return Math.max(0, Math.round(intervalElapsedSeconds) - targetSeconds);
}

/**
 * Past the target in FLOW mode the arc inverts: a second ring grows outward to
 * show overtime. This returns 0..1 across one further `targetSeconds`, so it
 * fills at the same rate the first ring drained.
 *
 * As with `arcProgress`, the `targetSeconds <= 0` guard is what stops a
 * recovery session — which has no target — reading as pure overtime.
 */
export function overtimeProgress(
  elapsedSeconds: number,
  targetSeconds: number,
): number {
  if (targetSeconds <= 0 || elapsedSeconds <= targetSeconds) return 0;
  const over = elapsedSeconds - targetSeconds;
  return Math.min(1, over / targetSeconds);
}

/**
 * The **macro** container: how much of the whole plan is left, 0..1.
 *
 * Breaks are counted. `arcProgress` measures against focus time only, which is
 * the right question for "am I going to finish the work", and the wrong one for
 * "how much longer am I sitting here". A pomodoro block of 3×25 with two
 * 5-minute breaks is 85 minutes of your afternoon, not 75, and the macro ring
 * is the thing that says so.
 *
 * `elapsedSeconds` is total active session time, which already spans breaks —
 * the clock keeps accumulating across an ADVANCE, only `intervalBaseMs` moves.
 * So this is a plain ratio and must not try to subtract break time back out.
 */
export function macroProgress(
  elapsedSeconds: number,
  plan: PlannedInterval[],
): number {
  const total = planTotalSeconds(plan);
  // Recovery's single interval has a target of zero, so its plan totals zero.
  // Same guard, same reason, as `arcProgress`: without it rest renders as a
  // fully spent container.
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - elapsedSeconds / total));
}

/**
 * The **micro** container: how much of the interval you are *currently in* is
 * left, 0..1.
 *
 * This is the one that moves fast enough to feel, which is the entire point of
 * showing it next to the macro ring. A 90-minute block barely appears to move;
 * the 25-minute pomodoro inside it visibly drains, and the pair together is
 * what makes both scales legible at once.
 */
export function microProgress(
  intervalElapsedSeconds: number,
  interval: PlannedInterval | undefined,
): number {
  if (!interval || interval.targetSeconds <= 0) return 0;
  return Math.min(
    1,
    Math.max(0, 1 - intervalElapsedSeconds / interval.targetSeconds),
  );
}

/**
 * Is there anything to gain from drawing both containers?
 *
 * BASIC, FLOW and RECOVERY are a single interval, so macro and micro are the
 * same number and the second ring would be a duplicate drawn at a different
 * radius — noise on a screen whose whole job is to be quiet.
 */
export function dualScale(plan: PlannedInterval[]): boolean {
  return plan.length > 1;
}

export type IntervalPosition = {
  interval: PlannedInterval;
  /** Seconds spent inside the current interval. */
  elapsedInInterval: number;
  /** Seconds of the whole plan that ended before this interval began. */
  offsetSeconds: number;
};

/** Where a given total elapsed lands within the plan. */
export function positionInPlan(
  plan: PlannedInterval[],
  index: number,
  elapsedInIntervalSeconds: number,
): IntervalPosition {
  const clampedIndex = Math.min(Math.max(0, index), plan.length - 1);
  const offsetSeconds = plan
    .slice(0, clampedIndex)
    .reduce((sum, interval) => sum + interval.targetSeconds, 0);

  return {
    interval: plan[clampedIndex],
    elapsedInInterval: elapsedInIntervalSeconds,
    offsetSeconds,
  };
}

/**
 * Where the tick marks sit around the ring, as fractions 0..1 of the plan's
 * total duration. These are what let you *see* a 60-minute block as three
 * pomodoros before you press start.
 */
export function intervalTickFractions(plan: PlannedInterval[]): number[] {
  const total = planTotalSeconds(plan);
  if (total <= 0 || plan.length < 2) return [];

  const fractions: number[] = [];
  let cursor = 0;

  for (const interval of plan.slice(0, -1)) {
    cursor += interval.targetSeconds;
    fractions.push(cursor / total);
  }

  return fractions;
}

// ---------------------------------------------------------------- mode traits

export const isRecovery = (mode: TimerMode): boolean => mode === "RECOVERY";

/**
 * Narrow a stored mode to a work shape.
 *
 * `Task.defaultMode` is typed `TimerMode` by Prisma because they share one
 * enum, but a task can never be a recovery session — you don't schedule rest
 * against a todo. The zod schema on the task form prevents it being written;
 * this is the read-side counterpart for rows that predate that, or that were
 * written some other way.
 */
export const toWorkMode = (mode: TimerMode): WorkMode =>
  mode === "RECOVERY" ? "POMODORO" : mode;

/**
 * The top-level choice. Work and recovery are peers; pomodoro/basic/flow are
 * shapes nested under work.
 */
export const sessionKind = (mode: TimerMode): SessionKind =>
  mode === "RECOVERY" ? "RECOVERY" : "WORK";

/**
 * Does this interval end on its own, or does the user have to stop it?
 *
 * Flow doesn't, because overrunning the goal is the feature. Recovery doesn't
 * either, for the opposite reason: rest that stops itself is just another
 * deadline wearing a different colour.
 */
export function endsAutomatically(mode: TimerMode): boolean {
  return mode !== "FLOW" && mode !== "RECOVERY";
}

/**
 * Recovery draws no progress of any kind. A ring that drains would turn rest
 * into a countdown, which is the exact failure this mode exists to prevent.
 */
export function hasProgressIndicator(mode: TimerMode): boolean {
  return mode !== "RECOVERY";
}

/** Does the readout climb rather than fall? */
export function countsUp(
  mode: TimerMode,
  elapsedSeconds: number,
  targetSeconds: number,
): boolean {
  if (mode === "RECOVERY") return true;
  return mode === "FLOW" && elapsedSeconds > targetSeconds;
}

/**
 * The number on the face, in seconds.
 *
 * One rule in one place: this logic was previously duplicated between the
 * timer screen and the mini badge, which is exactly how the two drift.
 */
export function readoutSeconds(
  mode: TimerMode,
  elapsedSeconds: number,
  targetSeconds: number,
): number {
  return countsUp(mode, elapsedSeconds, targetSeconds)
    ? elapsedSeconds
    : Math.max(0, targetSeconds - elapsedSeconds);
}

export const MODE_LABELS: Record<TimerMode, string> = {
  POMODORO: "Pomodoro",
  BASIC: "Timer",
  FLOW: "Flow",
  RECOVERY: "Recovery",
};

export const MODE_DESCRIPTIONS: Record<TimerMode, string> = {
  POMODORO: "Split the time into focus blocks with breaks between them.",
  BASIC: "One countdown. It stops itself when the time is up.",
  FLOW: "Keeps running past your goal. You decide when to stop.",
  RECOVERY: "No target and no countdown. It runs until you come back.",
};

export const INTERVAL_LABELS: Record<IntervalKind, string> = {
  FOCUS: "Focus",
  SHORT_BREAK: "Break",
  LONG_BREAK: "Long break",
  RECOVERY: "Recovery",
};
