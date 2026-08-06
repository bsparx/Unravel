import { toLocalDate, todayLocal } from "@/lib/dates";

/**
 * Habit step reset — pure logic. No React, no Prisma.
 *
 * A habit's steps live on the Task row and `TaskStep.completedAt` is a single
 * timestamp, so yesterday's ticks would survive into the new local day. The
 * reset marks exactly the ticks that belong to an earlier day: a tick is stale
 * the moment its instant is before the user's current local midnight — which
 * is computed per user timezone, never from the server's clock.
 */

/**
 * The zones a daily cron fires for.
 *
 * Deliberately a fixed list, not every zone: Vercel's Hobby plan allows at
 * most one cron run per day, and one daily run can only land on one zone's
 * midnight. The schedule in vercel.json fires at 00:00 Asia/Karachi (19:00
 * UTC, Pakistan has no DST), so only that zone gets a reset that lands on
 * time. Other zones would be reset hours late — resetting them at the wrong
 * moment is worse than leaving yesterday's ticks alone, so they are skipped
 * until this list is widened (a Pro schedule could run hourly and handle
 * every zone; the per-zone predicate below is correct for any cadence).
 */
export const HABIT_STEP_RESET_TIMEZONES = ["Asia/Karachi"] as const;

/**
 * Was this tick made before the current local day in `timezone`?
 *
 * `now` is the same instant for every zone; each zone gets its own cutoff.
 * A tick at 23:59 PKT resets at a 00:30 PKT run; a tick at 00:05 PKT survives
 * it. Never depends on the runtime's timezone.
 *
 * Compared as local-day buckets, not instants: `toLocalDate` maps the tick to
 * the calendar day it fell on, and that day either predates today's or it
 * doesn't — no offset math, so DST cannot skew it. (`tick < startOfLocalDay`
 * is exactly equivalent, which is the form the cron pushes into SQL.)
 */
export function tickIsStale(
  completedAt: Date,
  timezone: string,
  now: Date,
): boolean {
  return (
    toLocalDate(completedAt, timezone).getTime() <
    todayLocal(timezone, now).getTime()
  );
}
