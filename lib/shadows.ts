import "server-only";

import { addDays, startOfWeek, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { ShadowMark, User } from "@/lib/generated/prisma/client";
import { clampSlot, shortName, sigilFor, type Sigil } from "@/lib/identity-look";

export type ShadowCardData = {
  id: string;
  name: string;
  law: string | null;
  plan: string | null;
  against: { id: string; short: string; sigil: Sigil; colorSlot: number } | null;
  /** One entry per day of the current week, first day first. */
  week: { dateISO: string; mark: ShadowMark | null; isToday: boolean; isFuture: boolean }[];
  today: ShadowMark | null;
};

/**
 * The shadow side for the current week: active patterns and their marks. Two
 * queries in parallel; the marks are bounded to seven days, so this stays
 * small however long the history grows.
 */
export async function getShadowWeek(user: User): Promise<ShadowCardData[]> {
  const today = todayLocal(user.timezone);
  const weekStart = startOfWeek(today, user.weekStart);
  const todayISO = toISODate(today);

  const [patterns, logs] = await Promise.all([
    prisma.shadowPattern.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        law: true,
        plan: true,
        identity: {
          select: { id: true, name: true, sigil: true, archetype: true, colorSlot: true },
        },
      },
    }),
    prisma.shadowLog.findMany({
      where: { userId: user.id, date: { gte: weekStart, lte: addDays(weekStart, 6) } },
      select: { patternId: true, date: true, mark: true },
    }),
  ]);

  const marks = new Map(logs.map((log) => [`${log.patternId}:${toISODate(log.date)}`, log.mark]));
  const days = Array.from({ length: 7 }, (_, index) => toISODate(addDays(weekStart, index)));

  return patterns.map((pattern) => ({
    id: pattern.id,
    name: pattern.name,
    law: pattern.law,
    plan: pattern.plan,
    against: pattern.identity
      ? {
          id: pattern.identity.id,
          short: shortName(pattern.identity.name),
          sigil: sigilFor(pattern.identity.sigil, pattern.identity.archetype),
          colorSlot: clampSlot(pattern.identity.colorSlot),
        }
      : null,
    week: days.map((dateISO) => ({
      dateISO,
      mark: marks.get(`${pattern.id}:${dateISO}`) ?? null,
      isToday: dateISO === todayISO,
      isFuture: dateISO > todayISO,
    })),
    today: marks.get(`${pattern.id}:${todayISO}`) ?? null,
  }));
}
