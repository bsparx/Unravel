import "server-only";

import { prisma } from "@/lib/db";
import type { TaskOccurrence } from "@/lib/generated/prisma/client";
import {
  minutesFromSeconds,
  statusForTier,
  tierFor,
  type Quota,
} from "@/lib/quota";

/**
 * Every write that can change a habit's daily progress goes through here.
 *
 * The reason it's one function: `progress`, `tier` and `status` must never
 * disagree. `tier` is derived from `progress` against the quota, and `status`
 * is derived from `tier` — so a second code path that set any one of them
 * directly would eventually produce an occurrence that is DONE with tier NONE,
 * or a broken streak on a day the quota was actually met. Both are the kind of
 * bug you find a month later in a chart.
 *
 * A plain module rather than an export from a `"use server"` file: everything
 * exported from an actions file is a POST endpoint, and these take `userId` as
 * an argument.
 */

export type HabitQuotaRow = Quota & { taskId: string };

/** The quota for a habit, or null if it isn't one (or isn't yours). */
export async function getHabitQuota(
  userId: string,
  taskId: string,
): Promise<HabitQuotaRow | null> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, type: "HABIT" },
    select: {
      id: true,
      recurrence: {
        select: { unit: true, minimumQuota: true, optimalQuota: true },
      },
    },
  });

  if (!task?.recurrence) return null;

  return {
    taskId: task.id,
    unit: task.recurrence.unit,
    minimum: task.recurrence.minimumQuota,
    optimal: task.recurrence.optimalQuota,
  };
}

type ProgressChange =
  /** Absolute — "I did 12". */
  | { set: number }
  /** Relative — the +1 button, and the only safe shape under a double tap. */
  | { increment: number };

/**
 * Move a habit's progress for one day, and re-derive everything from it.
 *
 * `increment` is resolved against the row read inside the same call rather than
 * against a number the client sent, so two quick taps add two, not one.
 */
export async function setHabitProgress(
  userId: string,
  quota: HabitQuotaRow,
  date: Date,
  change: ProgressChange,
): Promise<TaskOccurrence> {
  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId: quota.taskId, date } },
    select: { progress: true },
  });

  const current = existing?.progress ?? 0;
  const next = Math.max(
    0,
    "set" in change ? Math.round(change.set) : current + Math.round(change.increment),
  );

  return writeProgress(userId, quota, date, next);
}

/**
 * Credit logged timer time to a MINUTES habit.
 *
 * Called from `endSession`. Deliberately a **floor against the day's total
 * logged time**, not an increment of this session's minutes: `endSession` can
 * be retried, and an increment would double-credit on a retry, which would show
 * up as a habit that hit its optimal on a day you didn't. Taking the max also
 * means a manually entered number is never clobbered downwards by a short
 * session.
 *
 * COUNT habits are untouched — the clock genuinely cannot see how many pages
 * you read, and guessing would be worse than asking.
 */
export async function creditLoggedTime(
  userId: string,
  taskId: string,
  date: Date,
  totalLoggedSeconds: number,
): Promise<void> {
  const quota = await getHabitQuota(userId, taskId);
  if (!quota || quota.unit !== "MINUTES") return;

  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId, date } },
    select: { progress: true },
  });

  const earned = minutesFromSeconds(totalLoggedSeconds);
  const next = Math.max(existing?.progress ?? 0, earned);

  if (next === (existing?.progress ?? 0)) return;

  await writeProgress(userId, quota, date, next);
}

/**
 * Ticking a habit by hand means "I did it" — so it books exactly the minimum,
 * never more. Someone who genuinely hit the optimal can say so; inferring it
 * from a checkbox would put a day in the optimal column that nobody claimed.
 *
 * Unticking clears the day back to zero rather than to "minimum minus one",
 * because the intent is "I hadn't actually done this".
 */
export async function toggleHabitDone(
  userId: string,
  quota: HabitQuotaRow,
  date: Date,
  done: boolean,
): Promise<TaskOccurrence> {
  if (!done) return writeProgress(userId, quota, date, 0);

  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId: quota.taskId, date } },
    select: { progress: true },
  });

  return writeProgress(
    userId,
    quota,
    date,
    Math.max(existing?.progress ?? 0, quota.minimum),
  );
}

async function writeProgress(
  userId: string,
  quota: HabitQuotaRow,
  date: Date,
  progress: number,
): Promise<TaskOccurrence> {
  const tier = tierFor(progress, quota);
  const status = statusForTier(tier);
  const completedAt = status === "DONE" ? new Date() : null;

  return prisma.taskOccurrence.upsert({
    where: { taskId_date: { taskId: quota.taskId, date } },
    create: {
      userId,
      taskId: quota.taskId,
      date,
      progress,
      tier,
      status,
      completedAt,
    },
    update: { progress, tier, status, completedAt },
  });
}
