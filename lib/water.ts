/**
 * Hydration math — pure functions. No React, no Prisma.
 *
 * The number: NASEM's adequate intake is roughly 13 cups (3L) of fluid a day
 * for men and 9 cups (2.1L) for women, all sources included — food is a real
 * fifth of it. The classic 8×8 (8 glasses × 250ml) is a fine baseline for most
 * women and low for most men, so the goal defaults to 8 and the settings let
 * it move anywhere in the 8–12 band the science actually describes.
 *
 * Precision is not the point. The failure this feature exists for is an ADHD
 * brain that forgets to drink at all — US adults already average ~5.5 glasses
 * of plain water a day, and hyperfocus drives it lower. Any number in range
 * beats five, so the maths optimises for *pacing*, not for the total: the
 * day's quota is spread evenly across a waking window, one glass every two
 * hours, and everything downstream is "are you on the line, ahead of it, or
 * behind it".
 */

export const MINUTES_PER_DAY = 1440;

export const DEFAULT_GOAL = 8;
export const MIN_GOAL = 4;
export const MAX_GOAL = 16;

/** 08:00 — the reminder window opens. */
export const DEFAULT_START_MIN = 480;
/** 22:00 — past this the day is a closed session: no more reminders. */
export const DEFAULT_END_MIN = 1320;

export const DEFAULT_INTERVAL_MIN = 120;
export const MIN_INTERVAL_MIN = 60;
export const MAX_INTERVAL_MIN = 240;

export type WaterSettings = {
  goal: number;
  remindersEnabled: boolean;
  startMin: number;
  endMin: number;
  intervalMin: number;
};

export const clampGoal = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(value)))
    : DEFAULT_GOAL;

export const clampInterval = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(MAX_INTERVAL_MIN, Math.max(MIN_INTERVAL_MIN, Math.round(value)))
    : DEFAULT_INTERVAL_MIN;

/** "1 glass" / "3 glasses" — the unit, agreeing in number. */
export function glassWord(value: number): string {
  const n = Math.max(0, Math.round(value));
  return `${n} ${n === 1 ? "glass" : "glasses"}`;
}

// ---------------------------------------------------------------- the pace line

/**
 * How many glasses the pace line says you should have had by `nowMinute`.
 *
 * The quota is spread evenly across the waking window: by 15:00 of an
 * 08:00–22:00 day, half the goal should be gone. Flooring keeps "on pace"
 * fair — a line that demands 4.3 glasses at 15:00 would call 4 a failure.
 */
export function expectedByNow(
  goal: number,
  startMin: number,
  endMin: number,
  nowMinute: number,
): number {
  if (nowMinute <= startMin) return 0;
  if (nowMinute >= endMin) return goal;
  const windowMinutes = Math.max(1, endMin - startMin);
  return Math.floor((goal * (nowMinute - startMin)) / windowMinutes);
}

/** The day is going to plan if the glasses meet or beat the pace line. */
export const onPace = (glasses: number, expected: number): boolean =>
  glasses >= expected;

export const glassesLeft = (goal: number, glasses: number): number =>
  Math.max(0, goal - Math.max(0, glasses));

/** The minute of day the pace line currently sits at. Null before the window. */
export function paceMarkerMinute(
  goal: number,
  expected: number,
  startMin: number,
  endMin: number,
): number | null {
  if (expected <= 0 || expected >= goal) return null;
  return (
    startMin +
    Math.round(((endMin - startMin) * expected) / Math.max(1, goal))
  );
}

/** Whole hours since the last glass. 0 = "less than an hour ago". */
export function hoursSince(lastTimeMin: number, nowMinute: number): number {
  return Math.max(0, Math.floor((nowMinute - lastTimeMin) / 60));
}

/**
 * Whether a reminder is due right now.
 *
 * The rules, in order: the window is open, the goal is not yet met, the day
 * is behind the pace line, and the last reminder is far enough back that this
 * one is a new nudge rather than a repeat. `lastNotifiedMin` null means none
 * has been sent — and on first contact with a behind day that reads as
 * "say it now, once", never as silence.
 *
 * The goal being met is the day's natural end: a notification budget that
 * never runs out gets the app muted at the OS level, which costs every future
 * alert as well as this one.
 */
export function reminderDue(
  settings: Pick<
    WaterSettings,
    | "remindersEnabled"
    | "goal"
    | "startMin"
    | "endMin"
    | "intervalMin"
  >,
  nowMinute: number,
  glasses: number,
  lastNotifiedMin: number | null,
): boolean {
  if (!settings.remindersEnabled) return false;
  if (nowMinute < settings.startMin || nowMinute >= settings.endMin) return false;
  if (glasses >= settings.goal) return false;
  if (
    onPace(glasses, expectedByNow(settings.goal, settings.startMin, settings.endMin, nowMinute))
  ) {
    return false;
  }
  if (lastNotifiedMin === null) return true;
  return nowMinute - lastNotifiedMin >= settings.intervalMin;
}

// ---------------------------------------------------------------- the light streak

/**
 * Consecutive days at or over the goal, ending today (inclusive).
 *
 * Deliberately lighter than the habit streak machinery: a streak is a good
 * nudge here but must never become pressure, because a body need that feels
 * like a losing streak is a reason to stop looking at the page. One number,
 * one quiet line, no engine.
 */
export function daysOnGoal(
  glassesByDate: ReadonlyMap<string, number>,
  goal: number,
  todayISO: string,
): number {
  let streak = 0;
  const cursor = new Date(`${todayISO}T00:00:00.000Z`);
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if ((glassesByDate.get(iso) ?? 0) < goal) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------- display

/**
 * The one line under the count. It says exactly one of four things — nothing
 * yet, behind, on pace, done — because the job of the page is to make the
 * next action obvious, and the next action is always "drink a glass".
 */
export function waterStatusLine({
  glasses,
  goal,
  expected,
  lastTimeMin,
  nowMinute,
}: {
  glasses: number;
  goal: number;
  expected: number;
  lastTimeMin: number | null;
  nowMinute: number;
}): string {
  if (glasses === 0) return "No glasses yet. Tap the glass to log your first.";
  if (glasses >= goal) return glasses > goal ? "A good day." : "Goal met.";

  const left = glassesLeft(goal, glasses);
  if (lastTimeMin !== null && hoursSince(lastTimeMin, nowMinute) >= 2) {
    const h = hoursSince(lastTimeMin, nowMinute);
    return onPace(glasses, expected)
      ? `Last glass ${h} hour${h === 1 ? "" : "s"} ago — on pace, ${left} to go.`
      : `Last glass ${h} hour${h === 1 ? "" : "s"} ago — ${left} to go.`;
  }
  if (onPace(glasses, expected)) return `On pace — ${left} to go.`;
  return `Behind pace — ${left} to go.`;
}

/** The notification body: the most specific actionable fact available. */
export function waterReminderBody({
  goal,
  glasses,
  lastTimeMin,
  nowMinute,
}: {
  goal: number;
  glasses: number;
  lastTimeMin: number | null;
  nowMinute: number;
}): string {
  const h =
    lastTimeMin === null ? null : hoursSince(lastTimeMin, nowMinute);
  if (h !== null && h >= 2) {
    return `Last glass was ${h} hours ago.`;
  }
  return `${glassWord(glassesLeft(goal, glasses))} to hit ${goal} today.`;
}

/** "12:40" — minutes from midnight, as a clock. For the edit list. */
export function formatMinuteOfDay(minute: number): string {
  const m = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(minute)));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * The one-word-ish verdict for a compact row: the day list and the rail have
 * room for "On pace", not for a sentence.
 */
export function waterStatusShort({
  glasses,
  goal,
  expected,
}: {
  glasses: number;
  goal: number;
  expected: number;
}): string {
  if (glasses === 0) return "No glasses yet";
  if (glasses >= goal) return glasses > goal ? "A good day" : "Goal met";
  return onPace(glasses, expected) ? "On pace" : "Behind pace";
}
