import "server-only";

import { getStatsRange } from "@/app/(app)/stats/_lib/queries";
import { formatFullDate, toISODate, todayLocal } from "@/lib/dates";
import { trackableItemHref } from "@/lib/ending-summary";
import type { User } from "@/lib/generated/prisma/client";
import { ENDING_SUMMARY_ITEM_ID } from "@/lib/stats-summary";
import { nextStep } from "@/lib/steps";
import { getTodayView, type TodayItem } from "@/lib/tasks";

export type DesktopDayItem = {
  id: string;
  type: "TODO" | "HABIT";
  title: string;
  priority: "P1" | "P2" | "P3" | "P4";
  estimatedSeconds: number | null;
  defaultMode: "POMODORO" | "BASIC" | "FLOW" | "RECOVERY";
  plannedIntervals: number | null;
  loggedSeconds: number;
  done: boolean;
  daysUntilDue: number | null;
  timeAnchorMinutes: number | null;
  project: { name: string; color: string } | null;
  minimalTask: string | null;
  nextStepTitle: string | null;
  stepsDone: number;
  stepsTotal: number;
  requiresFeedback: boolean;
  feedbackPrompt: string | null;
  missedYesterday: boolean;
};

export type DesktopDayPractice = {
  id: string;
  group: "mind" | "heart" | "close";
  title: string;
  scheduleLabel: string;
  timeHint: string | null;
  done: boolean;
  detail: string | null;
  completedTime: string | null;
  href: string;
};

export type DesktopDayPayload = {
  dateISO: string;
  dateLabel: string;
  plannedSeconds: number;
  loggedSeconds: number;
  completedCount: number;
  overdue: DesktopDayItem[];
  dueToday: DesktopDayItem[];
  habits: DesktopDayItem[];
  undated: DesktopDayItem[];
  completedToday: DesktopDayItem[];
  /** Enabled Mind/Heart practices (and Ending Summary) still remaining today (done on Unravel web). */
  practices: DesktopDayPractice[];
  /** Enabled Mind/Heart practices already completed today on Unravel web. */
  completedPractices: DesktopDayPractice[];
};

function serializeItem(item: TodayItem): DesktopDayItem {
  const upNext = nextStep(item.steps);
  const stepsDone = item.steps.filter((s) => s.completedAt !== null).length;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    priority: item.priority,
    estimatedSeconds: item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
    loggedSeconds: item.loggedSeconds,
    done: item.done,
    daysUntilDue: item.daysUntilDue,
    timeAnchorMinutes: item.timeAnchorMinutes,
    project: item.project
      ? { name: item.project.name, color: item.project.color }
      : null,
    minimalTask: item.bar?.minimalTask ?? null,
    nextStepTitle: upNext?.title ?? null,
    stepsDone,
    stepsTotal: item.steps.length,
    requiresFeedback: item.requiresFeedback,
    feedbackPrompt: item.feedbackPrompt,
    missedYesterday: item.missedYesterday,
  };
}

/**
 * Serialize `/day` (`getTodayView`) plus today's enabled Mind & Heart Practices
 * (`getStatsRange` for today) so the Ubuntu companion shows every open task,
 * remaining habit, and remaining selected Practice (with web deep links).
 */
export async function getDesktopDayPayload(
  user: User,
): Promise<DesktopDayPayload> {
  const today = todayLocal(user.timezone);
  const [view, statsToday] = await Promise.all([
    getTodayView(user),
    getStatsRange(user, today, today),
  ]);

  const todayRecord = statsToday.days[0];
  const practices: DesktopDayPractice[] = [];
  const completedPractices: DesktopDayPractice[] = [];

  for (const item of statsToday.items) {
    const isPractice =
      item.group === "mind" ||
      item.group === "heart" ||
      item.id === ENDING_SUMMARY_ITEM_ID;
    if (!isPractice) continue;

    const entry = todayRecord?.items[item.id];
    const done = entry?.status === "done" || entry?.status === "bonus";
    const group: DesktopDayPractice["group"] =
      item.id === ENDING_SUMMARY_ITEM_ID
        ? "close"
        : item.group === "heart"
          ? "heart"
          : "mind";

    const serialized: DesktopDayPractice = {
      id: item.id,
      group,
      title: item.title,
      scheduleLabel: item.scheduleLabel,
      timeHint: item.timeHint ?? null,
      done,
      detail: entry?.detail ?? null,
      completedTime: entry?.completedTime ?? null,
      href: trackableItemHref(item),
    };

    if (done) {
      completedPractices.push(serialized);
    } else {
      practices.push(serialized);
    }
  }

  return {
    dateISO: toISODate(view.date),
    dateLabel: formatFullDate(view.date),
    plannedSeconds: view.plannedSeconds,
    loggedSeconds: view.loggedSeconds,
    completedCount: view.completedToday.length + completedPractices.length,
    overdue: view.overdue.map(serializeItem),
    dueToday: view.dueToday.map(serializeItem),
    habits: view.habits.map(serializeItem),
    undated: view.undated.map(serializeItem),
    completedToday: view.completedToday.map(serializeItem),
    practices,
    completedPractices,
  };
}
