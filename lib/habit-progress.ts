import "server-only";

import { prisma } from "@/lib/db";
import type { TaskOccurrence } from "@/lib/generated/prisma/client";
import {
  dayStatus,
  minutesFromSeconds,
  recreditedProgress,
  type HabitBar,
  type HabitUnit,
} from "@/lib/habit-bar";

/**
 * Every write that can change a habit's day goes through here.
 *
 * The reason it's one function: `minimalTaskDone`, `progress` and `status`
 * must never disagree. `status` is derived from the first two — DONE exactly
 * when the claim is ticked or the log is non-empty — so a second code path
 * that set any one of them directly would eventually produce a day that is
 * DONE with nothing behind it, or a broken streak on a day the minimal task
 * was actually done. Both are the kind of bug you find a month later in a
 * chart.
 *
 * A plain module rather than an export from a `"use server"` file: everything
 * exported from an actions file is a POST endpoint, and these take `userId` as
 * an argument.
 */

export type HabitBarRow = HabitBar & {
  taskId: string;
  /** The day isn't DONE until a written note lands on the occurrence. */
  requiresFeedback: boolean;
};

/** The bar for a habit, or null if it isn't one (or isn't yours). */
export async function getHabitBar(
  userId: string,
  taskId: string,
): Promise<HabitBarRow | null> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId, type: "HABIT" },
    select: {
      id: true,
      requiresFeedback: true,
      recurrence: {
        select: { unit: true, minimalTask: true },
      },
    },
  });

  if (!task?.recurrence) return null;

  return {
    taskId: task.id,
    requiresFeedback: task.requiresFeedback,
    unit: task.recurrence.unit as HabitUnit,
    minimalTask: task.recurrence.minimalTask,
  };
}

type ProgressChange =
  /** Absolute — "I logged 12". */
  | { set: number }
  /** Relative — the +1 button, and the only safe shape under a double tap. */
  | { increment: number };

/**
 * Move a habit's optional log for one day, and re-derive the day from it.
 *
 * The claim is left alone: logging is not ticking. A non-empty log still marks
 * the day done — logging anything means you showed up — but it never *claims*
 * the minimal task, so correcting a log back to zero can still honestly leave
 * the day unclaimed.
 *
 * `increment` is resolved against the row read inside the same call rather
 * than against a number the client sent, so two quick taps add two, not one.
 */
export async function setHabitProgress(
  userId: string,
  bar: HabitBarRow,
  date: Date,
  change: ProgressChange,
): Promise<TaskOccurrence> {
  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId: bar.taskId, date } },
    select: { progress: true, minimalTaskDone: true },
  });

  const current = existing?.progress ?? 0;
  const next = Math.max(
    0,
    "set" in change
      ? Math.round(change.set)
      : current + Math.round(change.increment),
  );

  return writeProgress(userId, bar, date, {
    minimalTaskDone: existing?.minimalTaskDone ?? false,
    progress: next,
  });
}

/**
 * Credit logged timer time to a MINUTES habit.
 *
 * Called from `endSession`. Deliberately a **floor against the day's total
 * logged time**, not an increment of this session's minutes: `endSession` can
 * be retried, and an increment would double-credit on a retry. Taking the max
 * also means a hand-entered number is never clobbered downwards by a short
 * session.
 *
 * The claim is left alone, exactly as `setHabitProgress` leaves it: the clock
 * records what happened, the tick records what it meant.
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
  const bar = await getHabitBar(userId, taskId);
  if (!bar || bar.unit !== "MINUTES") return;

  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId, date } },
    select: { progress: true, minimalTaskDone: true },
  });

  const earned = minutesFromSeconds(totalLoggedSeconds);
  const next = Math.max(existing?.progress ?? 0, earned);

  if (next === (existing?.progress ?? 0)) return;

  await writeProgress(userId, bar, date, {
    minimalTaskDone: existing?.minimalTaskDone ?? false,
    progress: next,
  });
}

/**
 * Re-credit a MINUTES habit after a day's logged time has been *corrected*.
 *
 * The counterpart to `creditLoggedTime`, and the only path allowed to move the
 * log **down**. See `recreditedProgress` for why that is safe: the hand-entered
 * part of the figure is kept as a floor. The claim is never touched —
 * correcting a runaway session cannot take back the warmup.
 *
 * A no-op for COUNT habits, exactly as crediting is — the clock never had an
 * opinion about pages read, so correcting it has nothing to say either.
 */
export async function recreditLoggedTime(
  userId: string,
  taskId: string,
  date: Date,
  oldLoggedSeconds: number,
  newLoggedSeconds: number,
): Promise<void> {
  const bar = await getHabitBar(userId, taskId);
  if (!bar || bar.unit !== "MINUTES") return;

  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId, date } },
    select: { progress: true, minimalTaskDone: true },
  });

  const current = existing?.progress ?? 0;
  const next = recreditedProgress(current, oldLoggedSeconds, newLoggedSeconds);
  if (next === current) return;

  await writeProgress(userId, bar, date, {
    minimalTaskDone: existing?.minimalTaskDone ?? false,
    progress: next,
  });
}

/**
 * Ticking a habit by hand means "I did the minimal task" — the claim, and the
 * whole bar. It books **no number**: the log stays exactly as it was, because
 * a tick is a claim about the named act, not a measurement of it. Someone who
 * kept going has the log to say so; inferring a log from a checkbox would put
 * numbers in the chart that nobody entered.
 *
 * Unticking is "I hadn't actually done this" — so it clears the claim *and*
 * the log. A half-undo would leave the record of a day you just said didn't
 * happen.
 */
export async function toggleHabitDone(
  userId: string,
  bar: HabitBarRow,
  date: Date,
  done: boolean,
): Promise<TaskOccurrence> {
  const existing = await prisma.taskOccurrence.findUnique({
    where: { taskId_date: { taskId: bar.taskId, date } },
    select: { progress: true },
  });

  return writeProgress(userId, bar, date, {
    minimalTaskDone: done,
    progress: done ? (existing?.progress ?? 0) : 0,
  });
}

async function writeProgress(
  userId: string,
  bar: HabitBarRow,
  date: Date,
  day: { minimalTaskDone: boolean; progress: number },
): Promise<TaskOccurrence> {
  // A feedback habit's day is only *accepted* once a written note exists on
  // the occurrence. The claim and the log still record what happened — the
  // tick, the timer's minutes, the +1 taps — but the streak and the DONE
  // state wait. This is the one gate for every path: the timer's
  // creditLoggedTime, the +1 buttons and the checkbox all converge here, so
  // none of them can mark the day done behind the note's back.
  let noteOk = true;
  if (bar.requiresFeedback) {
    const existing = await prisma.taskOccurrence.findUnique({
      where: { taskId_date: { taskId: bar.taskId, date } },
      select: { note: true },
    });
    noteOk = Boolean(existing?.note?.trim());
  }

  const status = dayStatus(day, noteOk);
  const completedAt = status === "DONE" ? new Date() : null;

  return prisma.taskOccurrence.upsert({
    where: { taskId_date: { taskId: bar.taskId, date } },
    create: {
      userId,
      taskId: bar.taskId,
      date,
      minimalTaskDone: day.minimalTaskDone,
      progress: day.progress,
      status,
      completedAt,
    },
    update: {
      minimalTaskDone: day.minimalTaskDone,
      progress: day.progress,
      status,
      completedAt,
    },
  });
}
