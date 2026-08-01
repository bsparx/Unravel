import "server-only";

import { prisma } from "@/lib/db";
import { recreditLoggedTime } from "@/lib/habit-progress";
import {
  adjustedOvertime,
  clampLoggedSeconds,
  type TimerMode,
} from "@/lib/timer-math";

/**
 * Correcting a logged session.
 *
 * The server is the authority on duration *while a session runs* — that rule is
 * at the top of `app/(app)/timer/actions.ts` and nothing here weakens it. This
 * is the other half: once a session has ended, the number stops being a
 * measurement and becomes a claim about where the time went, and the person is
 * the authority on that. Two cases, and they are the same write:
 *
 * - The clock wasn't running. You did two hours on the train; the app saw none
 *   of it. Without this the honest move is to not log it, and a log you can't
 *   trust to be complete is one you stop reading.
 * - The clock was running and shouldn't have been. A timer left on overnight
 *   books seventeen hours against a five-minute task, and every average,
 *   estimate and habit tier downstream of it is now wrong. This is the more
 *   important case, because the bad number is *worse than no number*.
 *
 * The correction rewrites `elapsedSeconds` in place rather than sitting beside
 * it, because every aggregate in the app reads that column and a parallel
 * "corrected" column would mean auditing every one of them forever. What the
 * clock measured is preserved in `measuredSeconds` instead.
 */

export type AdjustResult =
  | { ok: true; loggedSeconds: number }
  | { ok: false; reason: "not-found" | "live" };

export async function adjustSessionSeconds(
  userId: string,
  sessionId: string,
  seconds: number,
): Promise<AdjustResult> {
  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      mode: true,
      taskId: true,
      occurrenceId: true,
      status: true,
      targetSeconds: true,
      elapsedSeconds: true,
      measuredSeconds: true,
    },
  });

  if (!session) return { ok: false, reason: "not-found" };

  // A running clock has not finished measuring, so there is nothing to
  // correct yet — and writing `elapsedSeconds` under it would be overwritten
  // by the next heartbeat anyway. Stop it first.
  if (session.status === "RUNNING" || session.status === "PAUSED") {
    return { ok: false, reason: "live" };
  }

  const logged = clampLoggedSeconds(seconds);
  const previous = session.elapsedSeconds;
  if (logged === previous) return { ok: true, loggedSeconds: logged };

  await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      elapsedSeconds: logged,
      // Kept in step so a later read of the row can't resurrect the old
      // figure through `serverElapsed`.
      accumulatedSeconds: logged,
      overtimeSeconds: adjustedOvertime(
        session.mode as TimerMode,
        logged,
        session.targetSeconds,
      ),
      // Only on the first correction: the point of this column is "what the
      // clock saw", and a second edit would replace that with the first edit.
      ...(session.measuredSeconds === null
        ? { measuredSeconds: previous }
        : {}),
      adjustedAt: new Date(),
    },
  });

  if (session.occurrenceId) {
    await rollUpOccurrence(userId, session.occurrenceId, session.taskId);
  }

  return { ok: true, loggedSeconds: logged };
}

/**
 * Recompute a day's `loggedSeconds` from the sessions themselves.
 *
 * `endSession` increments, which is right on the way in — it's one row's worth
 * of new time and an increment is the cheap correct write. A correction can't
 * increment: the delta may be negative, and applying a negative increment to a
 * counter that has drifted for any other reason would push it below zero. So
 * this sums, which also quietly heals any day where the counter and the
 * sessions had come apart.
 */
async function rollUpOccurrence(
  userId: string,
  occurrenceId: string,
  taskId: string | null,
): Promise<void> {
  const occurrence = await prisma.taskOccurrence.findUnique({
    where: { id: occurrenceId },
    select: { id: true, date: true, loggedSeconds: true },
  });
  if (!occurrence) return;

  const total = await prisma.focusSession.aggregate({
    where: { occurrenceId, status: "COMPLETED" },
    _sum: { elapsedSeconds: true },
  });

  const logged = Math.max(0, total._sum.elapsedSeconds ?? 0);

  await prisma.taskOccurrence.update({
    where: { id: occurrence.id },
    data: { loggedSeconds: logged },
  });

  // A MINUTES habit fills its quota from the clock, so a corrected clock has
  // to move the quota with it — otherwise the tier, the streak and every chart
  // on /habits/stats keep reporting the number that was just disowned.
  if (taskId) {
    await recreditLoggedTime(
      userId,
      taskId,
      occurrence.date,
      occurrence.loggedSeconds,
      logged,
    );
  }
}
