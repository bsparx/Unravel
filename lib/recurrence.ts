/**
 * Habit recurrence — pure functions, no Prisma, no React.
 *
 * The load-bearing idea: which days a habit is due is *computed* from the
 * recurrence rule, never stored. `TaskOccurrence` rows exist only for days the
 * user actually touched, so nothing is pre-generated for the future and the
 * absence of a row means "not done".
 */

import { addDays, dayOfWeek, diffInDays, eachDateInRange } from "@/lib/dates";

export type RecurrenceRule = {
  daysOfWeek: number[];
  startDate: Date;
  endDate: Date | null;
};

/** Is this habit due on `date`? `date` is a UTC-midnight LocalDate. */
export function isDueOn(rule: RecurrenceRule, date: Date): boolean {
  if (date.getTime() < rule.startDate.getTime()) return false;
  if (rule.endDate && date.getTime() > rule.endDate.getTime()) return false;
  return rule.daysOfWeek.includes(dayOfWeek(date));
}

/**
 * Every date in [from, to] the habit was due. Used for adherence denominators —
 * expected days are not rows, so this can only be computed, not queried.
 */
export function expectedDatesBetween(
  rule: RecurrenceRule,
  from: Date,
  to: Date,
): Date[] {
  const start =
    rule.startDate.getTime() > from.getTime() ? rule.startDate : from;
  const end =
    rule.endDate && rule.endDate.getTime() < to.getTime() ? rule.endDate : to;

  if (start.getTime() > end.getTime()) return [];

  return eachDateInRange(start, end).filter((date) =>
    rule.daysOfWeek.includes(dayOfWeek(date)),
  );
}

/** The next date on or after `from` that the habit is due. */
export function nextDueDate(
  rule: RecurrenceRule,
  from: Date,
  lookaheadDays = 366,
): Date | null {
  if (rule.daysOfWeek.length === 0) return null;

  for (let offset = 0; offset <= lookaheadDays; offset += 1) {
    const candidate = addDays(from, offset);
    if (rule.endDate && candidate.getTime() > rule.endDate.getTime()) {
      return null;
    }
    if (isDueOn(rule, candidate)) return candidate;
  }
  return null;
}

export type StreakResult = {
  current: number;
  longest: number;
};

/**
 * Walk the habit's due days backwards from `today` and count the streak.
 *
 * Rules:
 *  - only days the habit was actually due count, so a Mon/Wed/Fri habit is not
 *    broken by not doing it on Tuesday;
 *  - DONE extends the streak;
 *  - SKIPPED preserves it without extending it — an explicit "not today" is not
 *    the same as forgetting;
 *  - a due day with no row at all breaks it;
 *  - today is exempt: a habit you haven't got to yet hasn't been missed.
 */
export function computeStreak(
  rule: RecurrenceRule,
  completions: Map<string, "DONE" | "SKIPPED">,
  today: Date,
): StreakResult {
  const dueDates = expectedDatesBetween(rule, rule.startDate, today);
  if (dueDates.length === 0) return { current: 0, longest: 0 };

  const key = (date: Date) => date.toISOString().slice(0, 10);

  let longest = 0;
  let running = 0;

  for (const date of dueDates) {
    const status = completions.get(key(date));
    if (status === "DONE") {
      running += 1;
      longest = Math.max(longest, running);
    } else if (status === "SKIPPED") {
      // Holds the streak without extending it.
      continue;
    } else if (diffInDays(today, date) === 0) {
      // Today isn't a miss yet.
      continue;
    } else {
      running = 0;
    }
  }

  // The current streak is the tail of that same walk, counted backwards.
  let current = 0;
  for (let index = dueDates.length - 1; index >= 0; index -= 1) {
    const date = dueDates[index];
    const status = completions.get(key(date));

    if (status === "DONE") {
      current += 1;
    } else if (status === "SKIPPED") {
      continue;
    } else if (diffInDays(today, date) === 0) {
      continue;
    } else {
      break;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

/** How the habit's schedule reads in the UI. */
export function describeRecurrence(daysOfWeek: number[]): string {
  const days = [...new Set(daysOfWeek)].sort((a, b) => a - b);

  if (days.length === 0) return "No days selected";
  if (days.length === 7) return "Every day";

  const isWeekdays = days.join() === "1,2,3,4,5";
  if (isWeekdays) return "Weekdays";

  const isWeekends = days.join() === "0,6";
  if (isWeekends) return "Weekends";

  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((day) => names[day]).join(", ");
}
