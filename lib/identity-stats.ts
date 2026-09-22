import "server-only";

import { addDays, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import type { HabitStat } from "@/lib/habit-stats";
import { RANGE_DAYS, type StatsRange } from "@/lib/habit-range";
import {
  needsFocus,
  reinforceIdentities,
  type IdentityLink,
  type IdentityReinforcement,
  type IdentitySeed,
} from "@/lib/identity-reinforcement";

/**
 * The identity statistics read.
 *
 * One query on top of whatever habit-stats read you already have — the
 * identities and their links. The vote arithmetic is
 * `lib/identity-reinforcement.ts`, pure and exercised by `pnpm verify`.
 *
 * Which habit-stats read you hand in decides the lens: the whole set for
 * /identities, the current filter selection for /habits/stats (the filters
 * govern the whole page there, and identity numbers that disagreed with the
 * rows beside them would be the bug, not the feature).
 */
export async function getIdentityReinforcements(
  user: User,
  habits: HabitStat[],
  range: StatsRange,
): Promise<{
  identities: IdentityReinforcement[];
  /** The hungry ones, worst first. See `needsFocus`. */
  focus: IdentityReinforcement[];
}> {
  const records = await prisma.identity.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      statement: true,
      note: true,
      habits: { select: { taskId: true } },
    },
  });

  const seeds: IdentitySeed[] = records.map((record) => ({
    id: record.id,
    name: record.name,
    statement: record.statement,
    note: record.note,
  }));
  const links: IdentityLink[] = records.flatMap((record) =>
    record.habits.map((link) => ({ identityId: record.id, taskId: link.taskId })),
  );

  const today = todayLocal(user.timezone);
  const from = addDays(today, -(RANGE_DAYS[range] - 1));

  const identities = reinforceIdentities(seeds, links, habits, {
    fromISO: toISODate(from),
    toISO: toISODate(today),
    todayISO: toISODate(today),
  });

  return { identities, focus: needsFocus(identities) };
}