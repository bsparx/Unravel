/**
 * The daily prayer reset, run by the 4 AM Asia/Karachi cron.
 *
 * Wipes every PrayerCheck older than the current day — "wipe everything daily"
 * was the choice: no history, each cycle starts clean at Fajr. PrayerDayTimes
 * rows older than a week are pruned so a date is refetched from Aladhan (and
 * therefore reflects the city's current schedule) on the next visit, while
 * staying around long enough to serve as the offline fallback.
 */

import { prisma } from "@/lib/db";
import { addDays, todayLocal } from "@/lib/dates";

/**
 * Hobby plan: one cron run a day can only hit one zone's 4 AM. The reset
 * zones list is fixed here the same way `lib/habit-steps-reset.ts` fixes its
 * midnight zones — extend it when the plan can afford hourly runs.
 */
export const PRAYER_RESET_TIMEZONES = ["Asia/Karachi"] as const;

export type PrayerResetResult = {
  timezone: string;
  checksDeleted: number;
  cachePruned: number;
};

export async function resetPrayers(): Promise<PrayerResetResult[]> {
  const results: PrayerResetResult[] = [];

  for (const timezone of PRAYER_RESET_TIMEZONES) {
    const today = todayLocal(timezone);

    const { count: checksDeleted } = await prisma.prayerCheck.deleteMany({
      where: {
        user: { timezone },
        date: { lt: today },
      },
    });

    const { count: cachePruned } = await prisma.prayerDayTimes.deleteMany({
      where: {
        date: { lt: addDays(today, -7) },
      },
    });

    results.push({ timezone, checksDeleted, cachePruned });
  }

  return results;
}
