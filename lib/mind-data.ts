import type { User } from "@/lib/generated/prisma/client";
import { addDays, minuteOfDayLocal, toISODate, todayLocal } from "@/lib/dates";
import { wordCount, type DumpKind } from "@/lib/brain-dump";
import { prisma } from "@/lib/db";
import type { DisputationCard } from "@/lib/disputation";
import type { WishCard } from "@/lib/woop";
import {
  findMeditation,
  meditationTitle,
  normalizeOptions,
  type MeditationOptions,
} from "@/lib/meditations";
import { getReading, type ReadingView } from "@/lib/reading-data";
import { STRIP_DAYS, historySince, tend, type Tending } from "@/lib/tending";

/** How far back the journal on each daily tab reaches. */
const HISTORY_DAYS = 90;
/** Two weeks of sitting minutes, for the garden's day notes. */
const WEEK_DOTS = 14;
/** The most brain dumps the tab shows. */
const DUMP_ROWS = 60;

export type MeditationRow = {
  id: string;
  kind: string;
  title: string;
  seconds: number;
  completed: boolean;
  count: number | null;
  /** "Tue 17 Nov, 08:40" in the user's zone. */
  label: string;
};

export type MeditationView = {
  /** Newest first. */
  recent: MeditationRow[];
  /** Oldest first, ending today. */
  days: { dateISO: string; label: string; minutes: number }[];
  todayISO: string;
  /** What the picker opens on: the last sitting's choice. */
  last: { kind: string; options: MeditationOptions } | null;
  /** The garden: a stage up for each day you sit, down for each day you don't. */
  tending: Tending;
};

/** One brain dump, as its envelope shows it. */
export type DumpRow = {
  id: string;
  dateISO: string;
  /** "Thu 19 Nov". */
  dateLabel: string;
  /** "08:40", in the user's zone. */
  time: string;
  kind: DumpKind;
  paper: boolean;
  seconds: number;
  sent: number;
  words: number;
  /** Written today: it stays folded until tomorrow, and its words don't cross. */
  sealed: boolean;
  /** Null while sealed, and for a dump done on paper. */
  body: string | null;
};

export type BrainDumpView = {
  /** The balloon: kept by the days you emptied your head. */
  tending: Tending;
  todayISO: string;
  /** Minutes since midnight in the user's zone: picks the kind that suits the hour. */
  minuteOfDay: number;
  /** Newest first. */
  dumps: DumpRow[];
  /** What a day in the scene's strip held: "5 min", "2 dumps", "On paper". */
  notes: Record<string, string>;
};

export type MindEnabled = {
  braindump: boolean;
  meditate: boolean;
  reading: boolean;
  wishes: boolean;
  disputations: boolean;
};

export type MindView = {
  enabled: MindEnabled;
  active: WishCard[];
  settled: WishCard[];
  disputations: DisputationCard[];
  meditation: MeditationView;
  reading: ReadingView;
  braindump: BrainDumpView;
  /** The summit: kept by the days a wish was rehearsed. */
  wishTending: Tending;
  /** Wishes rehearsed today. */
  rehearsedToday: string[];
  /** The river: kept by the days one was written or revisited. */
  disputationTending: Tending;
};

export function mindEnabled(user: User): MindEnabled {
  return {
    wishes: user.mindWoopEnabled,
    disputations: user.mindDisputationEnabled,
    braindump: user.mindBrainDumpEnabled,
    meditate: user.mindMeditationEnabled,
    reading: user.mindReadingEnabled,
  };
}

/**
 * Everything /mind shows, in one round trip. Dates cross to the client as
 * ISO strings: the board is a client island and a Date would arrive as a
 * string anyway, just without saying so in the type.
 */
export async function getMind(user: User): Promise<MindView> {
  // Formatted here, in the user's own zone, so a note written at 23:50 is
  // filed under the day it was written and server and client agree.
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: user.timezone,
  });

  const today = todayLocal(user.timezone);
  const since = addDays(today, -HISTORY_DAYS);

  // The strip under each scene shows two weeks and today.
  const tendSince = addDays(today, -STRIP_DAYS);

  // A scene is kept by every day since the practice began (lib/tending.ts),
  // so the days it was done are read all the way back: dates only.
  const [
    wishes,
    disputations,
    sittings,
    reading,
    rehearsals,
    revisitDays,
    lastRevisits,
    dumps,
    dumpDays,
    sitDays,
  ] = await Promise.all([
    prisma.wish.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    }),
    prisma.disputation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.meditationSession.findMany({
      where: { userId: user.id, startedAt: { gte: addDays(today, -HISTORY_DAYS) } },
      orderBy: { startedAt: "desc" },
      take: 200,
    }),
    getReading(user),
    prisma.wishRehearsal.findMany({
      where: { userId: user.id },
      select: { wishId: true, date: true },
    }),
    prisma.disputationRevisit.findMany({
      where: { userId: user.id },
      distinct: ["date"],
      select: { date: true },
    }),
    // The latest revisit of each disputation, for its card.
    prisma.disputationRevisit.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      distinct: ["disputationId"],
      select: { disputationId: true, date: true, belief: true },
    }),
    prisma.brainDump.findMany({
      where: { userId: user.id, date: { gte: since } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: DUMP_ROWS,
    }),
    prisma.brainDump.findMany({
      where: { userId: user.id },
      select: { date: true, paper: true, seconds: true },
    }),
    // Sittings are instants; bucketed into the user's days below.
    prisma.meditationSession.findMany({
      where: { userId: user.id, seconds: { gt: 0 } },
      select: { startedAt: true },
    }),
  ]);

  // `date` is a calendar day stored at UTC midnight, so it's labelled in UTC.
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const todayISO = toISODate(today);

  const cards: WishCard[] = wishes.map((row) => ({
    id: row.id,
    wish: row.wish,
    outcome: row.outcome,
    obstacle: row.obstacle,
    plan: row.plan,
    status: row.status,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdLabel: day.format(row.createdAt),
    settledLabel: row.settledAt ? day.format(row.settledAt) : null,
  }));

  // Sittings are instants, so they're bucketed into days in the user's zone.
  const localISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: user.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const sitLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: user.timezone,
  });
  const minutesByDay = new Map<string, number>();
  for (const row of sittings) {
    const iso = localISO.format(row.startedAt);
    minutesByDay.set(iso, (minutesByDay.get(iso) ?? 0) + row.seconds / 60);
  }
  const lastRow = sittings[0];
  const lastMeditation = lastRow ? findMeditation(lastRow.kind) : null;
  const meditation: MeditationView = {
    tending: tend(
      historySince(
        todayISO,
        sitDays.map((row) => localISO.format(row.startedAt)),
        (date) => dayLabel.format(date),
      ),
    ),
    recent: sittings.slice(0, 30).map((row) => {
      const found = findMeditation(row.kind);
      const options = (row.options ?? {}) as MeditationOptions;
      return {
        id: row.id,
        kind: row.kind,
        title: found ? meditationTitle(found, options) : "A sitting",
        seconds: row.seconds,
        completed: row.completed,
        count: row.count,
        label: sitLabel.format(row.startedAt).replace(/ at /, ", "),
      };
    }),
    days: Array.from({ length: WEEK_DOTS }, (_, i) => {
      const date = addDays(today, i - WEEK_DOTS + 1);
      const iso = toISODate(date);
      return { dateISO: iso, label: dayLabel.format(date), minutes: minutesByDay.get(iso) ?? 0 };
    }),
    todayISO,
    last:
      lastRow && lastMeditation
        ? { kind: lastRow.kind, options: normalizeOptions(lastMeditation, (lastRow.options ?? {}) as MeditationOptions) }
        : null,
  };

  // Disputations are instants, bucketed into the user's day like sittings;
  // revisits are already calendar days.
  const disputedDays = [
    ...disputations.map((row) => localISO.format(row.createdAt)),
    ...revisitDays.map((row) => toISODate(row.date)),
  ];
  const rehearsedDays = rehearsals.map((row) => toISODate(row.date));
  const revisitOf = new Map(lastRevisits.map((row) => [row.disputationId, row]));

  // Brain dumps: today's stay folded, so only their shape crosses to the client.
  const dumpTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: user.timezone,
  });
  // What each recent day held, for the strip's tooltips.
  const byDay = new Map<string, { count: number; paper: number; seconds: number }>();
  for (const row of dumpDays) {
    if (row.date < tendSince) continue;
    const iso = toISODate(row.date);
    const day = byDay.get(iso) ?? { count: 0, paper: 0, seconds: 0 };
    day.count += 1;
    day.paper += row.paper ? 1 : 0;
    day.seconds += row.seconds;
    byDay.set(iso, day);
  }
  const braindump: BrainDumpView = {
    tending: tend(
      historySince(
        todayISO,
        dumpDays.map((row) => toISODate(row.date)),
        (date) => dayLabel.format(date),
      ),
    ),
    todayISO,
    minuteOfDay: minuteOfDayLocal(user.timezone),
    notes: Object.fromEntries(
      [...byDay].map(([iso, day]) => [
        iso,
        day.count > 1
          ? `${day.count} dumps`
          : day.paper
            ? "On paper"
            : day.seconds < 60
              ? "Under a minute"
              : `${Math.round(day.seconds / 60)} min`,
      ]),
    ),
    dumps: dumps.map((row) => {
      const dateISO = toISODate(row.date);
      const sealed = dateISO === todayISO;
      return {
        id: row.id,
        dateISO,
        dateLabel: dayLabel.format(row.date),
        time: dumpTime.format(row.createdAt),
        kind: row.kind,
        paper: row.paper,
        seconds: row.seconds,
        sent: row.sent,
        words: wordCount(row.body),
        sealed,
        body: sealed || row.paper ? null : row.body,
      };
    }),
  };

  return {
    enabled: mindEnabled(user),
    braindump,
    wishTending: tend(historySince(todayISO, rehearsedDays, (date) => dayLabel.format(date))),
    rehearsedToday: rehearsals.filter((row) => toISODate(row.date) === todayISO).map((row) => row.wishId),
    disputationTending: tend(historySince(todayISO, disputedDays, (date) => dayLabel.format(date))),
    meditation,
    reading,
    active: cards.filter((card) => card.status === "ACTIVE"),
    // Most recently settled first: what you just finished is what you want
    // to see when you open the drawer.
    settled: cards
      .filter((card) => card.status !== "ACTIVE")
      .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? "")),
    disputations: disputations.map((row) => ({
      id: row.id,
      adversity: row.adversity,
      belief: row.belief,
      beliefBefore: row.beliefBefore,
      consequences: row.consequences,
      evidence: row.evidence ?? "",
      alternatives: row.alternatives ?? "",
      implications: row.implications ?? "",
      usefulness: row.usefulness ?? "",
      energization: row.energization,
      beliefAfter: row.beliefAfter,
      createdAt: row.createdAt.toISOString(),
      createdLabel: day.format(row.createdAt),
      revisit: (() => {
        const last = revisitOf.get(row.id);
        if (!last) return null;
        return {
          belief: last.belief,
          label: dayLabel.format(last.date),
          today: toISODate(last.date) === todayISO,
        };
      })(),
    })),
  };
}
