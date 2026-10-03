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

/**
 * Book time (and optionally a note) onto a day's occurrence in one write,
 * creating the row if it's the first thing to touch that day.
 *
 * The same effect as `ensureOccurrence` then `addLoggedSeconds` then a re-read,
 * in one round trip instead of three: the upsert returns the row as it now
 * stands, `loggedSeconds` included.
 */
export async function logToOccurrence(
  userId: string,
  taskId: string,
  date: Date,
  { seconds = 0, note }: { seconds?: number; note?: string | null },
): Promise<TaskOccurrence> {
  const add = Math.max(0, Math.round(seconds));
  return prisma.taskOccurrence.upsert({
    where: { taskId_date: { taskId, date } },
    create: { userId, taskId, date, status: "PENDING", loggedSeconds: add, ...(note ? { note } : {}) },
    update: {
      ...(add > 0 ? { loggedSeconds: { increment: add } } : {}),
      ...(note ? { note } : {}),
    },
  });
}
