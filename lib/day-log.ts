/**
 * The day log — one row per user per local day.
 *
 * Shared anchor between the morning (what is today's one thing) and the
 * evening (how the day was closed). Created lazily, like TaskOccurrence: a day
 * nobody opened has no row, and absence means "nothing chosen".
 */

import { prisma } from "@/lib/db";
import type { DayLog, Task, User } from "@/lib/generated/prisma/client";
import type { StepLike } from "@/lib/steps";

export type DayLogWithSelection = DayLog & {
  selectedTask: Pick<
    Task,
    | "id"
    | "title"
    | "type"
    | "notes"
    | "estimatedSeconds"
    | "defaultMode"
    | "plannedIntervals"
    | "completedAt"
  > & { steps: StepLike[] } | null;
};

const selectionShape = {
  select: {
    id: true,
    title: true,
    type: true,
    notes: true,
    estimatedSeconds: true,
    defaultMode: true,
    plannedIntervals: true,
    completedAt: true,
    steps: {
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        position: true,
        estimatedSeconds: true,
        completedAt: true,
      },
    },
  },
} as const;

/** Today's row, or null if nothing has happened today yet. */
export async function getDayLog(
  user: User,
  date: Date,
): Promise<DayLogWithSelection | null> {
  return prisma.dayLog.findUnique({
    where: { userId_date: { userId: user.id, date } },
    include: { selectedTask: selectionShape },
  });
}

export async function ensureDayLog(
  userId: string,
  date: Date,
): Promise<DayLog> {
  return prisma.dayLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

/**
 * Set (or clear) the one thing for a day.
 *
 * A single upsert rather than read-modify-write — the `@@unique([userId,
 * date])` constraint is what makes that safe against two tabs racing.
 */
export async function setSelectedTask(
  userId: string,
  date: Date,
  taskId: string | null,
): Promise<void> {
  const selectedAt = taskId ? new Date() : null;

  await prisma.dayLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, selectedTaskId: taskId, selectedAt },
    update: { selectedTaskId: taskId, selectedAt },
  });
}

export async function markDayClosed(
  userId: string,
  date: Date,
): Promise<void> {
  await prisma.dayLog.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, closedAt: new Date() },
    update: { closedAt: new Date() },
  });
}
