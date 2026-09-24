/**
 * What a habit asks of a day — pure functions. No React, no Prisma.
 *
 * One bar, not two. The idea is atomic habits', sharpened: the bar is a
 * **named act** — "Do the warmup", "One push-up", "Read a page" — not a
 * number. Doing it is the day's whole requirement, and the only thing the
 * streak cares about. A bar you can clear on your worst day is the one that
 * survives a worst day, and a named act is a handle in a way "two minutes"
 * never is: "the warmup" is a thing you can *start*, which is the expensive
 * part. Nobody stops after the warmup, and the days they do still count.
 *
 * Anything past that is an **un-metered log**. `progress` counts it — minutes
 * from the timer, taps of a counter — and nothing measures it against a
 * target. There is deliberately no good-day bar and no second tier: making
 * the good day the requirement is precisely how streaks break, and a broken
 * streak costs more momentum than a good day ever earned.
 *
 * So a day is DONE when the claim is ticked or when anything at all landed in
 * the log. Not twice when both — it is one day, derived from one record.
 */

export type HabitUnit = "MINUTES" | "COUNT";

/** What counts as having done the habit, and what the log counts. */
export type HabitBar = {
  unit: HabitUnit;
  /** The smallest version that counts — "Do the warmup", "One push-up". */
  minimalTask: string;
};

/**
 * One day's record: the claim, and the optional log beside it.
 *
 * `minimalTaskDone` is deliberately its own flag rather than a number. A tick
 * books no quantity — it is a claim about the named act — so "did the warmup"
 * and "logged 2 minutes of warmup" stay distinguishable, and correcting a
 * runaway timer can never take back a claim nobody disputed.
 */
export type DayClaim = {
  minimalTaskDone: boolean;
  progress: number;
};

/**
 * The optional log's ceiling — a guard on the wire, not a target.
 *
 * There is no bar to hit, but "I did 2 billion" still has to fail somewhere
 * before it reaches the database. 10,000 minutes is longer than a week and
 * 10,000 pages is a small library: past that the number is a typo.
 */
export const MAX_LOG = 10_000;

/** Showing up is enough. Logging anything means you showed up. */
export const showedUp = (day: DayClaim): boolean =>
  day.minimalTaskDone || day.progress > 0;

/**
 * Did more than the claim — anything at all landed in the log.
 *
 * The only question "went beyond" ever asks. There is no threshold to be
 * past: the log has no target, only presence.
 */
export const wentBeyond = (day: DayClaim): boolean => day.progress > 0;

/**
 * The day's state, derived once and never stored twice.
 *
 * DONE exactly when something happened — the claim or the log — and any note
 * the habit demands has landed. `noteOk` is true when no note is required:
 * the feedback gate is the *caller's* business (it has to read the note), this
 * is the rule it applies. Lives here rather than in the write path so the rule
 * can be pinned by tests without a database.
 */
export const dayStatus = (day: DayClaim, noteOk = true): "DONE" | "PENDING" =>
  showedUp(day) && noteOk ? "DONE" : "PENDING";

// ---------------------------------------------------------------- the log

/**
 * Minutes of logged time, as habit progress.
 *
 * Floor, not round: 59 seconds is not a minute of log, and rounding up would
 * let a day's figure appear by opening the timer and closing it again.
 */
export const minutesFromSeconds = (seconds: number): number =>
  Math.max(0, Math.floor(seconds / 60));

/**
 * Habit progress after a day's logged time is *corrected*, rather than added to.
 *
 * `creditLoggedTime` only ever raises the log, which is right when time is
 * arriving: a retry must not double-count and a short session must not undo a
 * number you entered by hand. But it makes a correction downwards impossible,
 * and a correction downwards is the whole reason this exists — a timer left
 * running all night books a log nobody had.
 *
 * So this splits the current figure into the part the clock justified and the
 * part it didn't:
 *
 * - progress at or below what the old total earned was clock-derived, and
 *   follows the clock down.
 * - anything above it was entered or tapped by hand, and is a floor. Someone
 *   who said "I did this" does not lose it because a *different* session on
 *   the same date was wrong. (The claim itself is a separate flag and is
 *   never this function's business.)
 */
export function recreditedProgress(
  currentProgress: number,
  oldLoggedSeconds: number,
  newLoggedSeconds: number,
): number {
  const current = Math.max(0, currentProgress);
  const earnedBefore = minutesFromSeconds(oldLoggedSeconds);
  const earnedNow = minutesFromSeconds(newLoggedSeconds);
  const manualFloor = current > earnedBefore ? current : 0;

  return Math.max(earnedNow, manualFloor);
}

// ---------------------------------------------------------------- display

export const UNIT_LABELS: Record<HabitUnit, { one: string; many: string }> = {
  MINUTES: { one: "minute", many: "minutes" },
  COUNT: { one: "time", many: "times" },
};

export const UNIT_DESCRIPTIONS: Record<HabitUnit, string> = {
  MINUTES:
    "Counted from the timer. Run a session on this habit and the log fills itself.",
  COUNT: "Pages, reps, glasses — anything a clock can't see. You tap it in.",
};

/** "10 minutes" / "1 page" — the unit, agreeing in number. */
export function formatLogged(value: number, unit: HabitUnit): string {
  const label = UNIT_LABELS[unit];
  return `${value} ${value === 1 ? label.one : label.many}`;
}

/** Compact form for a row: "25m" / "×3". */
export const formatLoggedShort = (value: number, unit: HabitUnit): string =>
  unit === "MINUTES" ? `${value}m` : `×${value}`;

/** The sentence under a habit's title: what the day asks for. */
export function describeBar(bar: HabitBar): string {
  return `${bar.minimalTask} counts the whole day`;
}

/**
 * The claim, in the past tense, for the line that settles on completion.
 *
 * Conjugates the one verb the form's own copy models — "Do the warmup" becomes
 * "Did the warmup" — and falls back to a fixed frame for anything else
 * ("One push-up", "Read a page"). Rewriting a stranger's grammar would be
 * worse than a predictable frame: "Did it — Read a page" is clumsy once,
 * "Did Read a page" is broken.
 */
export function claimDone(minimalTask: string): string {
  const conjugated = minimalTask.replace(
    /^do\b/i,
    (match) => (match === "Do" ? "Did" : "did"),
  );
  return conjugated === minimalTask ? `Did it — ${minimalTask}` : conjugated;
}
