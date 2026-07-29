/**
 * Occurrence writes.
 *
 * Every write goes through `ensureOccurrence`, which relies on the
 * `@@unique([taskId, date])` constraint. That single constraint is what makes
 * "start a timer", "tick it off" and "skip it" all converge on the same row for
 * a given day, in any order, without a transaction fighting itself.
 */

import { prisma } from "@/lib/db";
import type { OccurrenceStatus, TaskOccurrence } from "@/lib/generated/prisma/client";

export async function ensureOccurrence(
  userId: string,
  taskId: string,
  date: Date,
): Promise<TaskOccurrence> {
  return prisma.taskOccurrence.upsert({
    where: { taskId_date: { taskId, date } },
    create: { userId, taskId, date, status: "PENDING" },
    // A no-op update is how upsert returns the existing row.
    update: {},
  });
}

export async function setOccurrenceStatus(
  userId: string,
  taskId: string,
  date: Date,
  status: OccurrenceStatus,
): Promise<TaskOccurrence> {
  const completedAt = status === "DONE" ? new Date() : null;

  return prisma.taskOccurrence.upsert({
    where: { taskId_date: { taskId, date } },
    create: { userId, taskId, date, status, completedAt },
    update: { status, completedAt },
  });
}

/** Add time to a day's roll-up, so the day list never has to aggregate. */
export async function addLoggedSeconds(
  occurrenceId: string,
  seconds: number,
): Promise<void> {
  if (seconds <= 0) return;

  await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: { loggedSeconds: { increment: Math.round(seconds) } },
  });
}
