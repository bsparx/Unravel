/**
 * Statistics summary logic — pure functions, no React, no Prisma.
 *
 * The statistics page shows one 2-week (14-day) window at a time and answers
 * two questions per day:
 *   1. Of the habits and Mind/Heart practices you selected, how many did you
 *      complete out of the ones that were actually active that day?
 *   2. How much productive time did you track that day?
 *
 * Load-bearing rule: a habit that is not active on a given day (not scheduled
 * for that weekday, before its startDate, or after its endDate) is NEVER
 * deducted from that day's denominator or the window's completion rate.
 */

import { addDays, parseLocalDate, toISODate } from "@/lib/dates";
import type { MindTab } from "@/lib/mind-tabs";
import type { HeartTab } from "@/lib/heart-tabs";
import type { TimerMode } from "@/lib/timer-math";

/** Each statistics view covers two weeks (14 days) so the page stays calm. */
export const WINDOW_DAYS = 14;

export type StatsWindow = {
  from: Date;
  to: Date;
  fromISO: string;
  endISO: string;
  /** True when the window ends on today. */
  isLatest: boolean;
  /** `end` query param for the preceding 2-week window. */
  prevEndISO: string;
  /**
   * `end` query param for the following 2-week window, `"latest"` when the
   * next step lands on today (clean `/stats`), or null when already on latest.
   */
  nextEndISO: string | null;
};

/**
 * Resolve a 14-day window ending on `endParam` (clamped to `today`).
 * Invalid or future dates degrade quietly to the latest 2 weeks.
 */
export function resolveStatsWindow(
  today: Date,
  endParam?: string | null,
): StatsWindow {
  const parsed = endParam ? parseLocalDate(endParam) : null;
  const to =
    parsed && parsed.getTime() < today.getTime() ? parsed : today;
  const from = addDays(to, -(WINDOW_DAYS - 1));
  const isLatest = to.getTime() >= today.getTime();
  const prevEnd = addDays(from, -1);

  let nextEndISO: string | null = null;
  if (!isLatest) {
    const candidate = addDays(to, WINDOW_DAYS);
    nextEndISO =
      candidate.getTime() >= today.getTime() ? "latest" : toISODate(candidate);
  }

  return {
    from,
    to,
    fromISO: toISODate(from),
    endISO: toISODate(to),
    isLatest,
    prevEndISO: toISODate(prevEnd),
    nextEndISO,
  };
}

export type TrackableGroup = "habit" | "mind" | "heart";

export type TrackableItem = {
  id: string;
  group: TrackableGroup;
  title: string;
  /** Readable schedule hint ("Every day", "Mon, Wed, Fri", "Mind", "Heart"). */
  scheduleLabel: string;
  /** Habits only: the small named promise, shown in day details. */
  minimalTask?: string | null;
};

export type DayItemStatus =
  | "done"
  | "skipped"
  | "missed"
  | "open"
  | "inactive"
  | "bonus";

export type DayItemEntry = {
  itemId: string;
  status: DayItemStatus;
  /** Optional context for day details ("10m", "18 pages", "On paper", etc.). */
  detail?: string | null;
};

export type DaySessionEntry = {
  id: string;
  title: string;
  mode: TimerMode | "MANUAL";
  seconds: number;
  overtimeSeconds: number;
  /** Local HH:MM start time, or null for manually logged time. */
  timeLabel: string | null;
};

export type StatsDayRecord = {
  iso: string;
  /** e.g. "Thu 19 Nov" */
  shortLabel: string;
  /** e.g. "Thursday, 19 November" */
  fullLabel: string;
  dayNumber: number;
  monthShort: string;
  /** 0 = Sunday .. 6 = Saturday */
  weekday: number;
  isToday: boolean;
  isYesterday: boolean;
  /** Work timer sessions + manual task/habit logs (breaks & recovery excluded). */
  productiveSeconds: number;
  /** Recovery sessions logged that day — displayed quietly in details, never mixed into work. */
  recoverySeconds: number;
  /** Status for every item in `items` on this day, keyed by `TrackableItem.id`. */
  items: Record<string, DayItemEntry>;
  /** Productive sessions & manual logs on this day. */
  sessions: DaySessionEntry[];
};

export type StatsOverview = {
  endISO: string;
  windowLabel: string;
  isLatest: boolean;
  prevEndISO: string;
  nextEndISO: string | null;
  weekStart: number;
  todayISO: string;
  /** All active habits + Settings-enabled Mind & Heart practices, in display order. */
  items: TrackableItem[];
  /** Dense 14-day series, oldest first. */
  days: StatsDayRecord[];
};

export const MIND_PRACTICE_LABELS: Record<MindTab, string> = {
  braindump: "Brain dump",
  meditate: "Meditation",
  reading: "Reading",
  wishes: "WOOP",
  disputations: "Disputation",
};

export const HEART_PRACTICE_LABELS: Record<HeartTab, string> = {
  gratitude: "Gratitude",
  dua: "Du'a",
  recitation: "Daily recitation",
};

export const mindItemId = (tab: MindTab): string => `mind:${tab}`;
export const heartItemId = (tab: HeartTab): string => `heart:${tab}`;

export type DaySummary = {
  done: number;
  active: number;
  skipped: number;
  bonus: number;
  inactive: number;
  /** 0..1 when at least one selected item was active; null when none were active. */
  ratio: number | null;
  /** 0..100 when at least one selected item was active; null otherwise. */
  percent: number | null;
};

/**
 * Compute one day's completion counts over the user's selected items.
 *
 * Items marked `inactive` (or `bonus` — done on an unscheduled day) are NEVER
 * added to `active`, so an off-day for a Mon/Wed/Fri habit never penalizes
 * Tuesday's score.
 */
export function summarizeDay(
  day: Pick<StatsDayRecord, "items">,
  selectedIds: ReadonlySet<string>,
): DaySummary {
  let done = 0;
  let active = 0;
  let skipped = 0;
  let bonus = 0;
  let inactive = 0;

  for (const id of selectedIds) {
    const entry = day.items[id];
    if (!entry) continue;

    switch (entry.status) {
      case "done":
        done += 1;
        active += 1;
        break;
      case "skipped":
        skipped += 1;
        active += 1;
        break;
      case "missed":
      case "open":
        active += 1;
        break;
      case "bonus":
        bonus += 1;
        inactive += 1;
        break;
      case "inactive":
        inactive += 1;
        break;
    }
  }

  const ratio = active > 0 ? done / active : null;
  const percent = ratio === null ? null : Math.round(ratio * 100);

  return { done, active, skipped, bonus, inactive, ratio, percent };
}

export type RangeSummary = {
  done: number;
  active: number;
  percent: number | null;
  perfectDays: number;
  activeHabitDays: number;
  totalProductiveSeconds: number;
  activeTimeDays: number;
  avgProductiveSeconds: number;
  todayProductiveSeconds: number;
  todayDone: number;
  todayActive: number;
};

/** Roll up the selected items and productive time across the window. */
export function summarizeRange(
  days: readonly StatsDayRecord[],
  selectedIds: ReadonlySet<string>,
): RangeSummary {
  let done = 0;
  let active = 0;
  let perfectDays = 0;
  let activeHabitDays = 0;
  let totalProductiveSeconds = 0;
  let activeTimeDays = 0;
  let todayProductiveSeconds = 0;
  let todayDone = 0;
  let todayActive = 0;

  for (const day of days) {
    const s = summarizeDay(day, selectedIds);
    done += s.done;
    active += s.active;
    if (s.active > 0) {
      activeHabitDays += 1;
      if (s.done === s.active) perfectDays += 1;
    }

    totalProductiveSeconds += day.productiveSeconds;
    if (day.productiveSeconds > 0) activeTimeDays += 1;

    if (day.isToday) {
      todayProductiveSeconds = day.productiveSeconds;
      todayDone = s.done;
      todayActive = s.active;
    }
  }

  return {
    done,
    active,
    percent: active > 0 ? Math.round((done / active) * 100) : null,
    perfectDays,
    activeHabitDays,
    totalProductiveSeconds,
    activeTimeDays,
    avgProductiveSeconds:
      activeTimeDays > 0 ? Math.round(totalProductiveSeconds / activeTimeDays) : 0,
    todayProductiveSeconds,
    todayDone,
    todayActive,
  };
}

/** Resolve selected item IDs from the current catalog minus excluded IDs. */
export function filterSelectedIds(
  allItems: readonly TrackableItem[],
  excludedIds: ReadonlySet<string>,
): Set<string> {
  const selected = new Set<string>();
  for (const item of allItems) {
    if (!excludedIds.has(item.id)) selected.add(item.id);
  }
  return selected;
}

export type CompletionLevel = "none" | "empty" | "low" | "mid" | "high" | "full";

/** Discrete visual fill level for a day's habit completion ratio. */
export function completionLevel(done: number, active: number): CompletionLevel {
  if (active <= 0) return "none";
  if (done <= 0) return "empty";
  if (done >= active) return "full";
  const ratio = done / active;
  if (ratio < 0.4) return "low";
  if (ratio < 0.75) return "mid";
  return "high";
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Seven short weekday labels starting on the user's preferred `weekStart`. */
export function orderedWeekdayLabels(weekStart: number): string[] {
  const start = ((weekStart % 7) + 7) % 7;
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(start + i) % 7]);
}

/**
 * Group a dense chronological list of days into calendar weeks (rows of 7)
 * aligned to `weekStart` (0 = Sunday .. 6 = Saturday), padding leading and
 * trailing slots with null.
 */
export function calendarWeeks(
  days: readonly StatsDayRecord[],
  weekStart: number,
): (StatsDayRecord | null)[][] {
  if (days.length === 0) return [];
  const start = ((weekStart % 7) + 7) % 7;
  const leading = (days[0].weekday - start + 7) % 7;
  const cells: (StatsDayRecord | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (StatsDayRecord | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
