import "server-only";

import { formatFullDate, toISODate } from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";
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
 * Serialize `/day` (`getTodayView`) for the Ubuntu desktop companion so the
 * desktop app displays the exact same open items and sections as `/day`.
 */
export async function getDesktopDayPayload(
  user: User,
): Promise<DesktopDayPayload> {
  const view = await getTodayView(user);
  return {
    dateISO: toISODate(view.date),
    dateLabel: formatFullDate(view.date),
    plannedSeconds: view.plannedSeconds,
    loggedSeconds: view.loggedSeconds,
    completedCount: view.completedToday.length,
    overdue: view.overdue.map(serializeItem),
    dueToday: view.dueToday.map(serializeItem),
    habits: view.habits.map(serializeItem),
    undated: view.undated.map(serializeItem),
    completedToday: view.completedToday.map(serializeItem),
  };
}
