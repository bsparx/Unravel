/**
 * Habit quotas — pure functions. No React, no Prisma.
 *
 * The idea, borrowed from atomic habits: a habit has two bars, not one.
 *
 *   **The minimum** is what counts as having done it. It is meant to be almost
 *   embarrassingly small — one page, two minutes, one push-up — because the
 *   streak is measured against *this*, and a bar you can clear on your worst
 *   day is the only kind that survives a worst day.
 *
 *   **The optimal** is what a good day looks like. It is deliberately not what
 *   the streak measures. Making the good day the bar is precisely how streaks
 *   break, and a broken streak is worth more lost momentum than a good day is
 *   worth gained.
 *
 * Statistics show both. The streak only ever asks about the minimum.
 */

export type HabitUnit = "MINUTES" | "COUNT";
export type QuotaTier = "NONE" | "MINIMUM" | "OPTIMAL";

export type Quota = {
  unit: HabitUnit;
  minimum: number;
  /** Null when the habit has no stretch goal. */
  optimal: number | null;
};

export const MAX_QUOTA = 10_000;

/** Ordered, so `TIER_RANK[a] > TIER_RANK[b]` is a meaningful comparison. */
export const TIER_RANK: Record<QuotaTier, number> = {
  NONE: 0,
  MINIMUM: 1,
  OPTIMAL: 2,
};

// ---------------------------------------------------------------- the rule

/**
 * Which bar a day's total progress clears.
 *
 * This is the whole "if you do the minimum and then carry on to the optimal it
 * counts only as optimal" rule, and it gets that behaviour for free by being a
 * function of the day's *total* rather than a reduction over a sequence of
 * events. There is no way to double count, because nothing is ever counted —
 * it's derived. Don't reintroduce an event log here.
 *
 * `optimal` is checked first: a quota where optimal <= minimum (which the form
 * prevents but old rows may hold) should read as the better of the two, not the
 * worse.
 */
export function tierFor(progress: number, quota: Quota): QuotaTier {
  const done = Math.max(0, Math.floor(progress));
  if (quota.optimal !== null && quota.optimal > 0 && done >= quota.optimal) {
    return "OPTIMAL";
  }
  if (quota.minimum > 0 && done >= quota.minimum) return "MINIMUM";
  // A minimum of zero would make every untouched day count as done, which
  // would quietly turn every habit into a permanent streak.
  return "NONE";
}

/** The only question the streak asks. */
export const meetsMinimum = (tier: QuotaTier): boolean => tier !== "NONE";

/**
 * The tier, as the occurrence status the rest of the app already speaks.
 *
 * Keeps one invariant true everywhere: a habit occurrence is DONE exactly when
 * its minimum was met. `computeStreak` and the adherence grid need no idea that
 * quotas exist.
 */
export const statusForTier = (tier: QuotaTier): "DONE" | "PENDING" =>
  meetsMinimum(tier) ? "DONE" : "PENDING";

// ---------------------------------------------------------------- progress

/**
 * How full the day's ring is drawn, 0..1.
 *
 * Measured against the optimal when there is one, so the minimum sits as a
 * marker partway round rather than filling the ring on day one. Without a
 * stretch goal the minimum *is* the whole ring.
 */
export function quotaRatio(progress: number, quota: Quota): number {
  const ceiling = quota.optimal ?? quota.minimum;
  if (ceiling <= 0) return 0;
  return Math.min(1, Math.max(0, progress / ceiling));
}

/** Where the minimum marker sits on that ring, 0..1. Null when it's the end. */
export function minimumMarkerRatio(quota: Quota): number | null {
  if (quota.optimal === null || quota.optimal <= quota.minimum) return null;
  return quota.minimum / quota.optimal;
}

/** What's still needed to keep the streak alive. Zero once it's safe. */
export const remainingToMinimum = (progress: number, quota: Quota): number =>
  Math.max(0, quota.minimum - Math.max(0, progress));

export const remainingToOptimal = (
  progress: number,
  quota: Quota,
): number | null =>
  quota.optimal === null ? null : Math.max(0, quota.optimal - Math.max(0, progress));

/**
 * Minutes of logged time, as habit progress.
 *
 * Floor, not round: 59 seconds of a 1-minute minimum is not a minute, and
 * rounding up would let a habit be completed by opening the timer and closing
 * it again.
 */
export const minutesFromSeconds = (seconds: number): number =>
  Math.max(0, Math.floor(seconds / 60));

/**
 * Habit progress after a day's logged time is *corrected*, rather than added to.
 *
 * `creditLoggedTime` only ever raises progress, which is right when time is
 * arriving: a retry must not double-count and a short session must not undo a
 * number you entered by hand. But it makes a correction downwards impossible,
 * and a correction downwards is the whole reason this exists — a timer left
 * running all night books an optimal day nobody had.
 *
 * So this splits the current figure into the part the clock justified and the
 * part it didn't:
 *
 * - progress at or below what the old total earned was clock-derived, and
 *   follows the clock down.
 * - anything above it was entered or ticked by hand, and is a floor. Someone
 *   who said "I did this" does not lose the day because a *different* session
 *   on the same date was wrong.
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

export const clampQuota = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_QUOTA, Math.max(1, Math.round(value)))
    : 1;

// ---------------------------------------------------------------- display

export const UNIT_LABELS: Record<HabitUnit, { one: string; many: string }> = {
  MINUTES: { one: "minute", many: "minutes" },
  COUNT: { one: "time", many: "times" },
};

export const UNIT_DESCRIPTIONS: Record<HabitUnit, string> = {
  MINUTES:
    "Counted from the timer. Run a session on this habit and the quota fills itself.",
  COUNT: "Pages, reps, glasses — anything a clock can't see. You tap it in.",
};

/** "10 minutes" / "1 page" — the unit, agreeing in number. */
export function formatQuota(value: number, unit: HabitUnit): string {
  const label = UNIT_LABELS[unit];
  return `${value} ${value === 1 ? label.one : label.many}`;
}

/** Compact form for a row: "10m" / "×10". */
export const formatQuotaShort = (value: number, unit: HabitUnit): string =>
  unit === "MINUTES" ? `${value}m` : `×${value}`;

/** The sentence under a habit's title. */
export function describeQuota(quota: Quota): string {
  const minimum = formatQuota(quota.minimum, quota.unit);
  if (quota.optimal === null) return `${minimum} to count`;
  return `${minimum} to count, ${quota.optimal} on a good day`;
}

export const TIER_LABELS: Record<QuotaTier, string> = {
  NONE: "Not yet",
  MINIMUM: "Minimum",
  OPTIMAL: "Optimal",
};
