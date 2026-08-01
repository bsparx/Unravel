import "server-only";

import type { LoggedSession } from "@/components/session-log";
import { formatTimestamp, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import type { TimerMode } from "@/lib/timer-math";

export type TodayLog = {
  /**
   * Time already committed to this day's roll-up. Deliberately **excludes** a
   * session still on the clock: nothing is written to the occurrence until
   * `endSession`, and the live seconds are added on the client so the number
   * moves. Adding them here as well would double-count every running second.
   */
  committedSeconds: number;
  /** Today's finished sessions, newest first — the correctable objects. */
  sessions: LoggedSession[];
};

/**
 * What this task has already had of today.
 *
 * The timer screen shows one duration, and it is the wrong one for the
 * question "how long have I spent on this today". A pomodoro that is 8 minutes
 * in says 8 minutes, whether or not you already gave it two hours this
 * morning. For someone with no felt sense of elapsed time that gap is the
 * whole problem — the day's total is the number that would have stopped the
 * third hour, and it was on another page.
 */
export async function getTodayLog(
  user: User,
  taskId: string,
): Promise<TodayLog> {
  const date = todayLocal(user.timezone);

  const [occurrence, sessions] = await Promise.all([
    prisma.taskOccurrence.findUnique({
      where: { taskId_date: { taskId, date } },
      select: { loggedSeconds: true },
    }),
    prisma.focusSession.findMany({
      where: {
        taskId,
        userId: user.id,
        status: "COMPLETED",
        localDate: date,
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        mode: true,
        startedAt: true,
        elapsedSeconds: true,
        overtimeSeconds: true,
        measuredSeconds: true,
      },
    }),
  ]);

  return {
    committedSeconds: occurrence?.loggedSeconds ?? 0,
    sessions: sessions.map((session) => ({
      id: session.id,
      mode: session.mode as TimerMode,
      startedLabel: formatTimestamp(session.startedAt, user.timezone),
      elapsedSeconds: session.elapsedSeconds,
      overtimeSeconds: session.overtimeSeconds,
      measuredSeconds: session.measuredSeconds,
    })),
  };
}
