import "server-only";

import { addDays, formatFullDate, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import type { EndingSummaryReport } from "@/lib/stats-summary";

/**
 * Yesterday's ending summary for `/` and `/day`. Single indexed lookup so
 * morning pages pay almost nothing. Returns null when the feature is off or
 * yesterday had no saved summary.
 */
export async function getYesterdayEndingSummary(
  user: User,
): Promise<EndingSummaryReport | null> {
  if (!user.endingSummaryEnabled) return null;

  const yesterday = addDays(todayLocal(user.timezone), -1);
  const row = await prisma.endingSummary.findUnique({
    where: { userId_date: { userId: user.id, date: yesterday } },
  });

  if (!row) return null;

  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: user.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return {
    dateISO: toISODate(yesterday),
    dateLabel: formatFullDate(yesterday),
    keepDoing: row.keepDoing,
    tryTomorrow: row.tryTomorrow,
    avoid: row.avoid,
    habitsDone: row.habitsDone,
    habitsTotal: row.habitsTotal,
    productiveSeconds: row.productiveSeconds,
    completedTime: localTime.format(row.createdAt),
  };
}
