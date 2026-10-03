import "server-only";

import { cache } from "react";

import { addDays, startOfWeek, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { IdentityKind, User } from "@/lib/generated/prisma/client";
import { clampSlot, shortName, sigilFor, type Sigil } from "@/lib/identity-look";
import {
  RECENT_DAYS,
  shadowSource,
  tallyVotes,
  type VoteEvent,
  type VoteTally,
} from "@/lib/vote-tally";

export type IdentityProfile = {
  id: string;
  name: string;
  short: string;
  statement: string | null;
  characteristics: string | null;
  kind: IdentityKind | null;
  archetype: string | null;
  question: string | null;
  colorSlot: number;
  sigil: Sigil;
  /** Habit ids that vote for this identity. */
  habitIds: string[];
};

export type IdentityWithVotes = IdentityProfile & { votes: VoteTally };

export type IdentityVotesRead = {
  identities: IdentityWithVotes[];
  todayISO: string;
  weekStartISO: string;
};

const EMPTY_TALLY: VoteTally = {
  total: 0,
  month: 0,
  week: 0,
  last7: 0,
  today: 0,
  strip: [],
  quietDays: 0,
};

/**
 * Every identity with its vote tally, in one parallel round of six small
 * queries: the identities and their links, the shadow patterns, and for each
 * vote source an all-time `groupBy` plus the last 28 days of rows. No history
 * is loaded beyond four weeks; the all-time numbers are counted by Postgres.
 *
 * `cache` dedupes it per request, so the layout, a page and its panels can all
 * ask without paying twice.
 */
export const getIdentityVotes = cache(async (user: User): Promise<IdentityVotesRead> => {
  const today = todayLocal(user.timezone);
  const from = addDays(today, -(RECENT_DAYS - 1));
  const weekStart = startOfWeek(today, user.weekStart);

  const [records, patterns, habitAllTime, habitRecent, shadowAllTime, shadowRecent] =
    await Promise.all([
      prisma.identity.findMany({
        where: { userId: user.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          statement: true,
          characteristics: true,
          kind: true,
          archetype: true,
          question: true,
          colorSlot: true,
          sigil: true,
          habits: { select: { taskId: true } },
        },
      }),
      prisma.shadowPattern.findMany({
        where: { userId: user.id, identityId: { not: null } },
        select: { id: true, identityId: true },
      }),
      prisma.taskOccurrence.groupBy({
        by: ["taskId"],
        where: { userId: user.id, status: "DONE" },
        _count: { _all: true },
      }),
      prisma.taskOccurrence.findMany({
        where: { userId: user.id, status: "DONE", date: { gte: from, lte: today } },
        select: { taskId: true, date: true },
      }),
      prisma.shadowLog.groupBy({
        by: ["patternId"],
        where: { userId: user.id, mark: "CHOSE" },
        _count: { _all: true },
      }),
      prisma.shadowLog.findMany({
        where: { userId: user.id, mark: "CHOSE", date: { gte: from, lte: today } },
        select: { patternId: true, date: true },
      }),
    ]);

  const sources = new Map<string, string[]>();
  for (const record of records) {
    for (const { taskId } of record.habits) {
      sources.set(taskId, [...(sources.get(taskId) ?? []), record.id]);
    }
  }
  for (const pattern of patterns) {
    if (pattern.identityId) sources.set(shadowSource(pattern.id), [pattern.identityId]);
  }

  const allTime = new Map<string, number>();
  for (const row of habitAllTime) allTime.set(row.taskId, row._count._all);
  for (const row of shadowAllTime) allTime.set(shadowSource(row.patternId), row._count._all);

  // Todo occurrences come back too (one query beats a join); sources without
  // a link simply vote for nobody.
  const recent: VoteEvent[] = [
    ...habitRecent.map((row) => ({ source: row.taskId, dateISO: toISODate(row.date) })),
    ...shadowRecent.map((row) => ({
      source: shadowSource(row.patternId),
      dateISO: toISODate(row.date),
    })),
  ];

  const todayISO = toISODate(today);
  const weekStartISO = toISODate(weekStart);
  const tallies = tallyVotes({
    identityIds: records.map((record) => record.id),
    sources,
    allTime,
    recent,
    todayISO,
    weekStartISO,
  });

  return {
    todayISO,
    weekStartISO,
    identities: records.map((record) => ({
      id: record.id,
      name: record.name,
      short: shortName(record.name),
      statement: record.statement,
      characteristics: record.characteristics,
      kind: record.kind,
      archetype: record.archetype,
      question: record.question,
      colorSlot: clampSlot(record.colorSlot),
      sigil: sigilFor(record.sigil, record.archetype),
      habitIds: record.habits.map((link) => link.taskId),
      votes: tallies.get(record.id) ?? EMPTY_TALLY,
    })),
  };
});

/**
 * Who leads today: the day's own choice, else the lead this week's review
 * chose, else nobody. Two tiny indexed reads in parallel.
 */
export const getLeadIdentityId = cache(async (user: User): Promise<string | null> => {
  const today = todayLocal(user.timezone);
  const weekStart = startOfWeek(today, user.weekStart);
  const [day, review] = await Promise.all([
    prisma.dayLog.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
      select: { leadIdentityId: true },
    }),
    prisma.weeklyReview.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      select: { leadIdentityId: true },
    }),
  ]);
  return day?.leadIdentityId ?? review?.leadIdentityId ?? null;
});
