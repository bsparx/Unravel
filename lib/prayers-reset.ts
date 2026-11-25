/**
 * The daily prayer housekeeping, run by the 4 AM Asia/Karachi cron.
 *
 * Prayer checks are kept: the five daily prayers are a Heart practice, and
 * its scene is kept by every day all five were prayed (lib/heart-data.ts),
 * so the history has to stay. (Checks used to be wiped each morning, back
 * when they only lived on the day page.) What the job still does is prune
 * PrayerDayTimes rows older than a week, so a date is refetched from Aladhan
 * (and so reflects the city's current schedule) on the next visit, while
 * staying around long enough to serve as the offline fallback.
 */

import { prisma } from "@/lib/db";
import { addDays, todayLocal } from "@/lib/dates";

/**
 * Hobby plan: one cron run a day can only hit one zone's 4 AM. The zones list
 * is fixed here the same way `lib/habit-steps-reset.ts` fixes its midnight
 * zones; extend it when the plan can afford hourly runs.
 */
export const PRAYER_RESET_TIMEZONES = ["Asia/Karachi"] as const;

export type PrayerResetResult = {
  timezone: string;
  cachePruned: number;
};

export async function resetPrayers(): Promise<PrayerResetResult[]> {
  const results: PrayerResetResult[] = [];

  for (const timezone of PRAYER_RESET_TIMEZONES) {
    const today = todayLocal(timezone);

    const { count: cachePruned } = await prisma.prayerDayTimes.deleteMany({
      where: {
        date: { lt: addDays(today, -7) },
      },
    });

    results.push({ timezone, cachePruned });
  }

  return results;
}
