import "server-only";

import { addDays, diffInDays, startOfWeek, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import { getIdentityVotes, type IdentityWithVotes } from "@/lib/identity-votes";

export type TreatView = {
  id: string;
  name: string;
  /** Null: the whole cast, counted over this week. */
  identity: { id: string; short: string; colorSlot: number } | null;
  votesNeeded: number;
  have: number;
  ready: boolean;
  enjoyed: boolean;
};

export type ObjectiveView = {
  id: string;
  text: string;
  target: number;
  have: number;
  habit: { id: string; title: string } | null;
};

export type ChapterView = {
  id: string;
  number: number;
  title: string;
  intro: string | null;
  reward: string | null;
  identity: { id: string; short: string; colorSlot: number; sigil: IdentityWithVotes["sigil"] };
  lengthDays: number;
  /** 1-based day of the chapter today, capped at its length. */
  day: number;
  objectives: ObjectiveView[];
  complete: boolean;
  completedAt: Date | null;
};

/**
 * Treats and chapters for one user. Treat progress reads the vote tally the
 * caller already has (so no second count), and chapter progress needs one
 * extra read: done days of the linked habits since the oldest open chapter
 * began. Everything else is two small selects, all in one round.
 */
export async function getRewards(
  user: User,
): Promise<{ treats: TreatView[]; chapters: ChapterView[]; finished: ChapterView[] }> {
  const today = todayLocal(user.timezone);
  const weekStart = startOfWeek(today, user.weekStart);

  const [{ identities }, treats, chapters] = await Promise.all([
    // Request-cached: a page that also reads the votes pays once.
    getIdentityVotes(user),
    prisma.treat.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, identityId: true, votesNeeded: true, enjoyedAt: true },
    }),
    prisma.chapter.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        identityId: true,
        title: true,
        intro: true,
        reward: true,
        startDate: true,
        lengthDays: true,
        completedAt: true,
        objectives: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            text: true,
            target: true,
            logged: true,
            habit: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  const byId = new Map(identities.map((identity) => [identity.id, identity]));
  const weekTotal = identities.reduce((sum, identity) => sum + identity.votes.week, 0);
  const treatViews: TreatView[] = treats.map((treat) => {
    const identity = treat.identityId ? byId.get(treat.identityId) : undefined;
    const have = identity ? identity.votes.total : weekTotal;
    // A cast treat belongs to its week: last week's enjoyment doesn't carry over.
    const enjoyed = treat.enjoyedAt !== null && (identity ? true : treat.enjoyedAt >= weekStart);
    return {
      id: treat.id,
      name: treat.name,
      identity: identity ? { id: identity.id, short: identity.short, colorSlot: identity.colorSlot } : null,
      votesNeeded: treat.votesNeeded,
      have,
      ready: have >= treat.votesNeeded,
      enjoyed,
    };
  });

  // Habit-linked objectives count the habit's done days inside the chapter.
  const open = chapters.filter((chapter) => !chapter.completedAt);
  const habitIds = [...new Set(open.flatMap((chapter) => chapter.objectives.flatMap((o) => (o.habit ? [o.habit.id] : []))))];
  const earliest = open.reduce<Date | null>(
    (min, chapter) => (!min || chapter.startDate < min ? chapter.startDate : min),
    null,
  );
  const doneDays =
    habitIds.length && earliest
      ? await prisma.taskOccurrence.findMany({
          where: { userId: user.id, taskId: { in: habitIds }, status: "DONE", date: { gte: earliest, lte: today } },
          select: { taskId: true, date: true },
        })
      : [];

  const numberOf = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const chapter of chapters) {
    const next = (counters.get(chapter.identityId) ?? 0) + 1;
    counters.set(chapter.identityId, next);
    numberOf.set(chapter.id, next);
  }

  const views: ChapterView[] = chapters.flatMap((chapter) => {
    const identity = byId.get(chapter.identityId);
    if (!identity) return [];
    const end = addDays(chapter.startDate, chapter.lengthDays - 1);
    const objectives = chapter.objectives.map((objective) => {
      const have = objective.habit
        ? doneDays.filter(
            (row) => row.taskId === objective.habit!.id && row.date >= chapter.startDate && row.date <= end,
          ).length
        : objective.logged;
      return { id: objective.id, text: objective.text, target: objective.target, have, habit: objective.habit };
    });
    return [{
      id: chapter.id,
      number: numberOf.get(chapter.id)!,
      title: chapter.title,
      intro: chapter.intro,
      reward: chapter.reward,
      identity: { id: identity.id, short: identity.short, colorSlot: identity.colorSlot, sigil: identity.sigil },
      lengthDays: chapter.lengthDays,
      day: Math.min(chapter.lengthDays, Math.max(1, diffInDays(today, chapter.startDate) + 1)),
      objectives,
      complete: objectives.every((objective) => objective.have >= objective.target),
      completedAt: chapter.completedAt,
    }];
  });

  return {
    treats: treatViews,
    chapters: views.filter((chapter) => !chapter.completedAt),
    finished: views.filter((chapter) => chapter.completedAt).reverse().slice(0, 5),
  };
}
