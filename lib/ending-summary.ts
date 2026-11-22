/**
 * Ending summary — pure comparison math and formatting helpers, no React, no
 * Prisma. Shared between /close, /stats, /day, /, and `pnpm verify`.
 *
 * Compares today's statistics (selected habits + Mind/Heart practices and total
 * productive time) against:
 *   1. The rolling 30-day average prior to today ("Monthly avg")
 *   2. The same weekday's average over the last 8 weeks prior to today
 *      (e.g., "Sunday avg")
 *
 * Load-bearing fairness rules:
 *   - Today is excluded from both baselines so it is never compared against itself.
 *   - Days before the user's earliest tracked activity in the lookback window
 *     are excluded so brand-new accounts aren't pulled down by empty history.
 *   - The Ending Summary habit itself is excluded from the /close comparison so
 *     reviewing your day never penalizes today's score before you press Save.
 */

import { addDays, formatDuration, parseLocalDate, toISODate, WEEKDAYS } from "@/lib/dates";
import {
  ENDING_SUMMARY_ITEM_ID,
  summarizeDay,
  type EndingSummaryReport,
  type MissedHabitNote,
  type StatsDayRecord,
  type TrackableItem,
} from "@/lib/stats-summary";

/** 8 weeks of history gives up to 8 same-weekday samples and a full 30-day baseline. */
export const ENDING_SUMMARY_LOOKBACK_DAYS = 56;
export const ENDING_SUMMARY_MONTH_DAYS = 30;
export const ENDING_SUMMARY_MAX_CHARS = 1000;
export const MISSED_NOTE_MAX_CHARS = 300;
export const MISSED_NOTES_MAX = 30;

export type EndingSummaryDaySlice = Pick<
  StatsDayRecord,
  "iso" | "weekday" | "productiveSeconds" | "items"
>;

export type OpenHabitItem = {
  item: TrackableItem;
  href: string;
};

/** Safe parser for `EndingSummary.missedNotes` JSON stored in Postgres. */
export function parseMissedNotes(raw: unknown): MissedHabitNote[] {
  if (!Array.isArray(raw)) return [];
  const out: MissedHabitNote[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const itemId = typeof obj.itemId === "string" ? obj.itemId.trim() : "";
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
    if (!itemId || !title || !reason || seen.has(itemId)) continue;
    seen.add(itemId);
    out.push({
      itemId: itemId.slice(0, 80),
      title: title.slice(0, 200),
      reason: reason.slice(0, MISSED_NOTE_MAX_CHARS),
    });
    if (out.length >= MISSED_NOTES_MAX) break;
  }
  return out;
}

/** Direct link to go complete a trackable habit or Mind/Heart practice. */
export function trackableItemHref(item: Pick<TrackableItem, "id" | "group">): string {
  if (item.group === "mind" && item.id.startsWith("mind:")) {
    return `/mind?tab=${item.id.slice("mind:".length)}`;
  }
  if (item.group === "heart" && item.id.startsWith("heart:")) {
    return `/heart?tab=${item.id.slice("heart:".length)}`;
  }
  if (item.id === ENDING_SUMMARY_ITEM_ID) {
    return "/close?step=summary";
  }
  return `/habits#habit-${item.id}`;
}

/**
 * Selected habits and Mind/Heart practices that are scheduled today and still
 * incomplete (excludes off-days, skipped items, and Ending Summary itself).
 */
export function incompleteTodayItems(
  items: readonly TrackableItem[],
  today: Pick<StatsDayRecord, "items"> | null | undefined,
  selectedIds: ReadonlySet<string>,
): OpenHabitItem[] {
  if (!today) return [];
  const open: OpenHabitItem[] = [];
  for (const item of items) {
    if (item.id === ENDING_SUMMARY_ITEM_ID) continue;
    if (!selectedIds.has(item.id)) continue;
    const status = today.items[item.id]?.status;
    if (status === "open" || status === "missed") {
      open.push({ item, href: trackableItemHref(item) });
    }
  }
  return open;
}

export type AverageBaseline = {
  /** Prior days included in this baseline (0 when there is no history yet). */
  sampleDays: number;
  /** Mean habits completed per day with at least one active habit. */
  avgHabitsDone: number | null;
  /** Weighted habit completion percentage across the baseline window (0..100). */
  avgHabitsPercent: number | null;
  /** Mean productive seconds per day across the baseline window. */
  avgProductiveSeconds: number;
};

export type EndingSummaryComparison = {
  today: {
    iso: string;
    weekdayName: string;
    habitsDone: number;
    habitsActive: number;
    habitsPercent: number | null;
    productiveSeconds: number;
    focusSeconds: number;
    practiceSeconds: number;
  };
  monthAvg: AverageBaseline;
  weekdayAvg: AverageBaseline;
  deltas: {
    vsMonthPercent: number | null;
    vsMonthSeconds: number | null;
    vsWeekdayPercent: number | null;
    vsWeekdaySeconds: number | null;
  };
};

export function hasEndingSummaryNotes(
  report:
    | Pick<EndingSummaryReport, "keepDoing" | "tryTomorrow" | "avoid"> & {
        missedNotes?: readonly MissedHabitNote[];
      }
    | null
    | undefined,
): boolean {
  if (!report) return false;
  return Boolean(
    report.keepDoing?.trim() ||
      report.tryTomorrow?.trim() ||
      report.avoid?.trim() ||
      (report.missedNotes && report.missedNotes.length > 0),
  );
}

/** Count how many optional reflection sections have non-empty text. */
export function countEndingSummaryNotes(
  report:
    | Pick<EndingSummaryReport, "keepDoing" | "tryTomorrow" | "avoid"> & {
        missedNotes?: readonly MissedHabitNote[];
      }
    | null
    | undefined,
): number {
  if (!report) return 0;
  let count = 0;
  if (report.keepDoing?.trim()) count += 1;
  if (report.tryTomorrow?.trim()) count += 1;
  if (report.avoid?.trim()) count += 1;
  if (report.missedNotes && report.missedNotes.length > 0) {
    count += report.missedNotes.length;
  }
  return count;
}

function summarizeBaseline(
  entries: {
    done: number;
    active: number;
    totalProductiveSeconds: number;
  }[],
): AverageBaseline {
  const sampleDays = entries.length;
  if (sampleDays === 0) {
    return {
      sampleDays: 0,
      avgHabitsDone: null,
      avgHabitsPercent: null,
      avgProductiveSeconds: 0,
    };
  }

  let sumDone = 0;
  let sumActive = 0;
  let habitDays = 0;
  let sumProductive = 0;

  for (const e of entries) {
    sumProductive += e.totalProductiveSeconds;
    if (e.active > 0) {
      habitDays += 1;
      sumDone += e.done;
      sumActive += e.active;
    }
  }

  return {
    sampleDays,
    avgHabitsDone:
      habitDays > 0 ? Math.round((sumDone / habitDays) * 10) / 10 : null,
    avgHabitsPercent:
      sumActive > 0 ? Math.round((sumDone / sumActive) * 100) : null,
    avgProductiveSeconds: Math.round(sumProductive / sampleDays),
  };
}

/**
 * Compute today's numbers and compare them against the rolling 30-day average
 * and the same weekday's average over the lookback window.
 */
export function computeEndingSummaryComparison(
  days: readonly EndingSummaryDaySlice[],
  selectedIds: ReadonlySet<string>,
  todayISO: string,
): EndingSummaryComparison {
  // Exclude Ending Summary itself from the /close comparison so today isn't
  // penalized before the user saves the very reflection they're writing.
  const evalIds = new Set<string>();
  for (const id of selectedIds) {
    if (id !== ENDING_SUMMARY_ITEM_ID) evalIds.add(id);
  }

  const todayDate = parseLocalDate(todayISO);
  const monthStartISO = todayDate
    ? toISODate(addDays(todayDate, -ENDING_SUMMARY_MONTH_DAYS))
    : "";

  const summarized = days.map((day) => ({
    day,
    summary: summarizeDay(day, evalIds),
  }));

  const todayEntry = summarized.find((entry) => entry.day.iso === todayISO);
  const todayWeekday =
    todayEntry?.day.weekday ?? (todayDate ? todayDate.getUTCDay() : 0);
  const weekdayName = WEEKDAYS[todayWeekday]?.long ?? "Today";

  const todaySummary = todayEntry?.summary ?? {
    done: 0,
    active: 0,
    percent: null,
    practiceSeconds: 0,
    totalProductiveSeconds: 0,
  };
  const todayFocusSeconds = todayEntry?.day.productiveSeconds ?? 0;

  const prior = summarized
    .filter((entry) => entry.day.iso < todayISO)
    .sort((a, b) => a.day.iso.localeCompare(b.day.iso));

  // Start both baselines from the earliest day in the lookback with real
  // activity, so new accounts aren't dragged down by days before they started.
  const firstActive = prior.find(
    (entry) =>
      entry.summary.done > 0 || entry.summary.totalProductiveSeconds > 0,
  );

  const eligiblePrior = firstActive
    ? prior.filter((entry) => entry.day.iso >= firstActive.day.iso)
    : [];

  const monthEntries = eligiblePrior
    .filter((entry) => !monthStartISO || entry.day.iso >= monthStartISO)
    .map((entry) => entry.summary);

  const weekdayEntries = eligiblePrior
    .filter((entry) => entry.day.weekday === todayWeekday)
    .map((entry) => entry.summary);

  const monthAvg = summarizeBaseline(monthEntries);
  const weekdayAvg = summarizeBaseline(weekdayEntries);

  const vsMonthPercent =
    todaySummary.percent !== null && monthAvg.avgHabitsPercent !== null
      ? todaySummary.percent - monthAvg.avgHabitsPercent
      : null;

  const vsMonthSeconds =
    monthAvg.sampleDays > 0
      ? todaySummary.totalProductiveSeconds - monthAvg.avgProductiveSeconds
      : null;

  const vsWeekdayPercent =
    todaySummary.percent !== null && weekdayAvg.avgHabitsPercent !== null
      ? todaySummary.percent - weekdayAvg.avgHabitsPercent
      : null;

  const vsWeekdaySeconds =
    weekdayAvg.sampleDays > 0
      ? todaySummary.totalProductiveSeconds - weekdayAvg.avgProductiveSeconds
      : null;

  return {
    today: {
      iso: todayISO,
      weekdayName,
      habitsDone: todaySummary.done,
      habitsActive: todaySummary.active,
      habitsPercent: todaySummary.percent,
      productiveSeconds: todaySummary.totalProductiveSeconds,
      focusSeconds: todayFocusSeconds,
      practiceSeconds: todaySummary.practiceSeconds,
    },
    monthAvg,
    weekdayAvg,
    deltas: {
      vsMonthPercent,
      vsMonthSeconds,
      vsWeekdayPercent,
      vsWeekdaySeconds,
    },
  };
}

/** Signed percentage delta, e.g. "+12%", "-5%", or "Same". */
export function formatDeltaPercent(delta: number): string {
  if (delta === 0) return "On avg";
  return `${delta > 0 ? "+" : ""}${delta}%`;
}

/** Signed duration delta, e.g. "+45m", "-1h 10m", or "On avg". */
export function formatDeltaDuration(deltaSeconds: number): string {
  const abs = Math.abs(Math.round(deltaSeconds));
  if (abs < 60) return "On avg";
  const sign = deltaSeconds > 0 ? "+" : "-";
  return `${sign}${formatDuration(abs)}`;
}
