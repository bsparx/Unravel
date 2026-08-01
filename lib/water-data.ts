import "server-only";

import { prisma } from "@/lib/db";
import { addDays, toISODate } from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";
import {
  daysOnGoal,
  type WaterSettings,
} from "@/lib/water";

/** The user's water settings, out of the always-loaded User row. */
export function waterSettingsFrom(
  user: Pick<
    User,
    | "waterGoal"
    | "waterRemindersEnabled"
    | "waterReminderStartMin"
    | "waterReminderEndMin"
    | "waterReminderIntervalMin"
  >,
): WaterSettings {
  return {
    goal: user.waterGoal,
    remindersEnabled: user.waterRemindersEnabled,
    startMin: user.waterReminderStartMin,
    endMin: user.waterReminderEndMin,
    intervalMin: user.waterReminderIntervalMin,
  };
}

export type WaterGlassRow = { id: string; timeMinute: number };

export type WaterDay = {
  settings: WaterSettings;
  dateISO: string;
  /** Today's glasses, oldest first — the edit list. */
  glasses: WaterGlassRow[];
  /** The count; derived from the list so the two can never disagree. */
  count: number;
  /** The latest glass's minute, or null. What "last glass was 2h ago" reads. */
  lastTimeMin: number | null;
  /** Consecutive days at or over the goal, ending today (inclusive). */
  streak: number;
};

/**
 * Everything the /water page renders. Two indexed reads: today's rows for the
 * vessel and edit list, and sixty days of dates for the streak — the count
 * never lives in a column, because the list IS the truth.
 */
export async function getWaterDay(user: User, date: Date): Promise<WaterDay> {
  const dateISO = toISODate(date);
  const [glasses, recent] = await Promise.all([
    prisma.waterGlass.findMany({
      where: { userId: user.id, date },
      orderBy: { timeMinute: "asc" },
      select: { id: true, timeMinute: true },
    }),
    prisma.waterGlass.findMany({
      where: { userId: user.id, date: { gte: addDays(date, -60) } },
      select: { date: true },
    }),
  ]);

  const glassesByDate = new Map<string, number>();
  for (const row of recent) {
    const iso = toISODate(row.date);
    glassesByDate.set(iso, (glassesByDate.get(iso) ?? 0) + 1);
  }

  const last = glasses[glasses.length - 1];

  return {
    settings: waterSettingsFrom(user),
    dateISO,
    glasses,
    count: glasses.length,
    lastTimeMin: last ? last.timeMinute : null,
    streak: daysOnGoal(glassesByDate, user.waterGoal, dateISO),
  };
}

export type WaterToday = Pick<
  WaterDay,
  "settings" | "dateISO" | "count" | "lastTimeMin"
>;

/**
 * The small slice the reminder needs, for the app-wide mount: settings plus
 * today's count and latest glass. Kept separate from `getWaterDay` so the
 * shared layout doesn't pay for the streak query on every route visit.
 */
export async function getWaterToday(
  user: User,
  date: Date,
): Promise<WaterToday> {
  const dateISO = toISODate(date);
  const last = await prisma.waterGlass.findFirst({
    where: { userId: user.id, date },
    orderBy: { timeMinute: "desc" },
    select: { timeMinute: true },
  });

  const count = last
    ? await prisma.waterGlass.count({
        where: { userId: user.id, date },
      })
    : 0;

  return {
    settings: waterSettingsFrom(user),
    dateISO,
    count,
    lastTimeMin: last ? last.timeMinute : null,
  };
}
