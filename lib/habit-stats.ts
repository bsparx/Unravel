import "server-only";

import { addDays, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import {
  computeStreak,
  expectedDatesBetween,
  isDueOn,
  type RecurrenceRule,
} from "@/lib/recurrence";
import { RANGE_DAYS, type StatsRange } from "@/lib/habit-range";
import type { HabitBar, HabitUnit } from "@/lib/habit-bar";

/**
 * The habit statistics read.
 *
 * Two queries total, whatever the filters: every habit's recurrence, and every
 * occurrence in the range. Everything else — which days were due, what was
 * missed, streaks, per-day rollups — is computed in memory over what is at most
 * a few hundred rows.
 *
 * It has to work that way. "Missed" is the absence of a row on a day the habit
 * was due, and due-ness is a rule, not a table. There is no `WHERE` clause that
 * can find a row that was never written.
 *
 * One bar, one outcome: a due day is DONE when the minimal task happened, and
 * *separately* it may have gone beyond — anything in the optional log. There
 * is no good-day tier to bucket by, because there is no second bar to fall
 * short of.
 */

// Re-exported for server callers; defined in a client-safe module so the
// filter control can import them without pulling Prisma into the browser.
export { RANGE_DAYS, isStatsRange, type StatsRange } from "@/lib/habit-range";

export type DayOutcome = "DONE" | "SKIPPED" | "MISSED" | "PENDING";

export type HabitDay = {
  dateISO: string;
  outcome: DayOutcome;
  /** Kept going: anything at all landed in the optional log. */
  wentBeyond: boolean;
  progress: number;
  loggedSeconds: number;
};

export type HabitStat = {
  id: string;
  title: string;
  bar: HabitBar;
  daysOfWeek: number[];
  archived: boolean;

  /** Due days inside the range. The denominator for everything below. */
  expected: number;
  /** Due days where the minimal task happened — the whole bar. */
  doneDays: number;
  /** Of those, days that kept going past the claim. */
  wentBeyondDays: number;
  skippedDays: number;
  missedDays: number;
  /** Percent of due days that were done. 0..100. */
  adherence: number;
  /** Of the days you showed up, how many kept going. 0..100. */
  wentBeyondShare: number;

  currentStreak: number;
  longestStreak: number;

  loggedSeconds: number;
  totalProgress: number;

  days: HabitDay[];
};

export type HabitStatsView = {
  range: StatsRange;
  fromISO: string;
  toISO: string;
  habits: HabitStat[];
  /** Every habit that exists, for the filter control — not just the selected. */
  allHabits: { id: string; title: string; archived: boolean }[];
  /** One row per day across the selection, for the charts. */
  daily: {
    dateISO: string;
    done: number;
    wentBeyond: number;
    missed: number;
    skipped: number;
    loggedSeconds: number;
  }[];
  totals: {
    expected: number;
    doneDays: number;
    wentBeyondDays: number;
    missedDays: number;
    skippedDays: number;
    loggedSeconds: number;
    adherence: number;
  };
};

export async function getHabitStats(
  user: User,
  range: StatsRange,
  selectedIds: string[] = [],
): Promise<HabitStatsView> {
  const today = todayLocal(user.timezone);
  const from = addDays(today, -(RANGE_DAYS[range] - 1));

  const habits = await prisma.task.findMany({
    where: { userId: user.id, type: "HABIT" },
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      archivedAt: true,
      recurrence: {
        select: {
          daysOfWeek: true,
          startDate: true,
          endDate: true,
          unit: true,
          minimalTask: true,
        },
      },
    },
  });

  const withRule = habits.filter((habit) => habit.recurrence !== null);

  const allHabits = withRule.map((habit) => ({
    id: habit.id,
    title: habit.title,
    archived: habit.archivedAt !== null,
  }));

  // An empty selection means "all of them" rather than "none": a filter that
  // starts by hiding everything makes the page look broken on first open.
  const selected =
    selectedIds.length > 0
      ? withRule.filter((habit) => selectedIds.includes(habit.id))
      : withRule;

  // The streak walk needs history from before the visible range — a 7-day view
  // must still be able to say "42 in a row". Occurrences are fetched from the
  // earliest start date, and only the range is charted.
  const earliestStart = selected.reduce(
    (earliest: Date | null, habit) =>
      !earliest || habit.recurrence!.startDate.getTime() < earliest.getTime()
        ? habit.recurrence!.startDate
        : earliest,
    null,
  );

  const occurrences =
    selected.length === 0
      ? []
      : await prisma.taskOccurrence.findMany({
          where: {
            userId: user.id,
            taskId: { in: selected.map((habit) => habit.id) },
            date: {
              gte: earliestStart && earliestStart.getTime() < from.getTime()
                ? earliestStart
                : from,
              lte: today,
            },
          },
          select: {
            taskId: true,
            date: true,
            status: true,
            minimalTaskDone: true,
            progress: true,
            loggedSeconds: true,
          },
        });

  const byHabit = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) {
    const list = byHabit.get(occurrence.taskId) ?? [];
    list.push(occurrence);
    byHabit.set(occurrence.taskId, list);
  }

  const stats: HabitStat[] = selected.map((habit) => {
    const recurrence = habit.recurrence!;
    const rule: RecurrenceRule = {
      daysOfWeek: recurrence.daysOfWeek,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate,
    };

    const rows = byHabit.get(habit.id) ?? [];
    const byDate = new Map(rows.map((row) => [toISODate(row.date), row]));

    // Streaks walk the habit's whole history, not the filtered window.
    const completions = new Map<string, "DONE" | "SKIPPED">();
    for (const row of rows) {
      if (row.status === "DONE" || row.status === "SKIPPED") {
        completions.set(toISODate(row.date), row.status);
      }
    }
    const streak = computeStreak(rule, completions, today);

    const dueDates = expectedDatesBetween(rule, from, today);
    const dueSet = new Set(dueDates.map(toISODate));
    const todayISO = toISODate(today);

    const days: HabitDay[] = [];
    let doneDays = 0;
    let wentBeyondDays = 0;
    let skippedDays = 0;
    let missedDays = 0;
    let loggedSeconds = 0;
    let totalProgress = 0;

    for (const date of eachDay(from, today)) {
      const dateISO = toISODate(date);
      const row = byDate.get(dateISO);

      loggedSeconds += row?.loggedSeconds ?? 0;
      totalProgress += row?.progress ?? 0;

      if (!dueSet.has(dateISO)) {
        // Not due. Deliberately absent from `days` — a Mon/Wed/Fri habit must
        // not read as failing four days a week.
        continue;
      }

      const outcome = outcomeFor(row, dateISO === todayISO);
      const beyond = (row?.progress ?? 0) > 0;
      days.push({
        dateISO,
        outcome,
        wentBeyond: beyond,
        progress: row?.progress ?? 0,
        loggedSeconds: row?.loggedSeconds ?? 0,
      });

      if (outcome === "DONE") {
        doneDays += 1;
        if (beyond) wentBeyondDays += 1;
      } else if (outcome === "SKIPPED") skippedDays += 1;
      else if (outcome === "MISSED") missedDays += 1;
    }

    const expected = dueDates.length;

    return {
      id: habit.id,
      title: habit.title,
      bar: {
        unit: recurrence.unit as HabitUnit,
        minimalTask: recurrence.minimalTask,
      },
      daysOfWeek: recurrence.daysOfWeek,
      archived: habit.archivedAt !== null,
      expected,
      doneDays,
      wentBeyondDays,
      skippedDays,
      missedDays,
      adherence: expected > 0 ? Math.round((doneDays / expected) * 100) : 0,
      wentBeyondShare:
        doneDays > 0 ? Math.round((wentBeyondDays / doneDays) * 100) : 0,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      loggedSeconds,
      totalProgress,
      days,
    };
  });

  return {
    range,
    fromISO: toISODate(from),
    toISO: toISODate(today),
    habits: stats,
    allHabits,
    daily: rollUpByDay(from, today, stats, selected, occurrences),
    totals: {
      expected: sum(stats, (stat) => stat.expected),
      doneDays: sum(stats, (stat) => stat.doneDays),
      wentBeyondDays: sum(stats, (stat) => stat.wentBeyondDays),
      missedDays: sum(stats, (stat) => stat.missedDays),
      skippedDays: sum(stats, (stat) => stat.skippedDays),
      loggedSeconds: sum(stats, (stat) => stat.loggedSeconds),
      adherence: percent(
        sum(stats, (stat) => stat.doneDays),
        sum(stats, (stat) => stat.expected),
      ),
    },
  };
}

/**
 * Today is never "missed".
 *
 * A habit you haven't got to yet at 10am is not a failure, and colouring it as
 * one is how a statistics page becomes something you avoid opening.
 *
 * The claim and the log both read as DONE here even while a feedback note
 * still gates the *streak* — exactly the job `tier` used to do. What happened
 * happened; whether the day was accepted is the streak's business.
 */
function outcomeFor(
  row:
    | { status: string; minimalTaskDone: boolean; progress: number }
    | undefined,
  isToday: boolean,
): DayOutcome {
  if (row?.status === "SKIPPED") return "SKIPPED";
  if (row && (row.minimalTaskDone || row.progress > 0)) return "DONE";
  return isToday ? "PENDING" : "MISSED";
}

function rollUpByDay(
  from: Date,
  to: Date,
  stats: HabitStat[],
  selected: { id: string }[],
  occurrences: { taskId: string; date: Date; loggedSeconds: number }[],
): HabitStatsView["daily"] {
  const selectedIds = new Set(selected.map((habit) => habit.id));

  const logged = new Map<string, number>();
  for (const row of occurrences) {
    if (!selectedIds.has(row.taskId)) continue;
    const key = toISODate(row.date);
    logged.set(key, (logged.get(key) ?? 0) + row.loggedSeconds);
  }

  const outcomes = new Map<
    string,
    Record<DayOutcome, number> & { wentBeyond: number }
  >();
  for (const stat of stats) {
    for (const day of stat.days) {
      const bucket =
        outcomes.get(day.dateISO) ??
        { DONE: 0, SKIPPED: 0, MISSED: 0, PENDING: 0, wentBeyond: 0 };
      bucket[day.outcome] += 1;
      if (day.outcome === "DONE" && day.wentBeyond) bucket.wentBeyond += 1;
      outcomes.set(day.dateISO, bucket);
    }
  }

  return [...eachDay(from, to)].map((date) => {
    const dateISO = toISODate(date);
    const bucket = outcomes.get(dateISO);
    return {
      dateISO,
      done: bucket?.DONE ?? 0,
      wentBeyond: bucket?.wentBeyond ?? 0,
      missed: bucket?.MISSED ?? 0,
      skipped: bucket?.SKIPPED ?? 0,
      loggedSeconds: logged.get(dateISO) ?? 0,
    };
  });
}

function* eachDay(from: Date, to: Date): Generator<Date> {
  for (
    let cursor = from;
    cursor.getTime() <= to.getTime();
    cursor = addDays(cursor, 1)
  ) {
    yield cursor;
  }
}

const sum = <T,>(items: T[], of: (item: T) => number): number =>
  items.reduce((total, item) => total + of(item), 0);

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/** Re-exported so pages don't need a second import for the due-day check. */
export { isDueOn };
