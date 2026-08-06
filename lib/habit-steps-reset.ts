import "server-only";

import { prisma } from "@/lib/db";
import { startOfLocalDay } from "@/lib/dates";
import { HABIT_STEP_RESET_TIMEZONES } from "@/lib/habit-steps";

/**
 * Uncheck every habit step ticked before the current local day.
 *
 * One updateMany per reset timezone, scoped three ways: the step's user lives
 * in that zone, the step belongs to a HABIT (todo checklists stay ticked),
 * and the tick predates the zone's start of day — the predicate from
 * `tickIsStale` pushed into SQL as `completedAt < startOfLocalDay`. Idempotent:
 * a second run the same day matches zero rows, so a retried cron is harmless.
 *
 * `completedAt` is the only per-tick log; clearing it is all the reset is.
 */
export async function resetStaleHabitSteps(now = new Date()): Promise<{
  timezones: string[];
  cleared: number;
}> {
  let cleared = 0;

  for (const timezone of HABIT_STEP_RESET_TIMEZONES) {
    const cutoff = startOfLocalDay(timezone, now);

    const result = await prisma.taskStep.updateMany({
      where: {
        user: { timezone },
        task: { type: "HABIT" },
        completedAt: { lt: cutoff },
      },
      data: { completedAt: null },
    });

    cleared += result.count;
  }

  return { timezones: [...HABIT_STEP_RESET_TIMEZONES], cleared };
}
