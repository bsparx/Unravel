import type { User } from "@/lib/generated/prisma/client";
import { addDays, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { DisputationCard } from "@/lib/disputation";
import {
  clampCount,
  templateOrDefault,
  findTemplate,
  readItems,
  type PracticeKind,
  type PracticePage,
} from "@/lib/practices";
import type { WishCard } from "@/lib/woop";
import {
  findMeditation,
  meditationTitle,
  normalizeOptions,
  type MeditationOptions,
} from "@/lib/meditations";

/** How far back the journal on each daily tab reaches. */
const HISTORY_DAYS = 90;
/** The quiet row of dots: written or not, no streak counted. */
const WEEK_DOTS = 14;

export type PracticeView = {
  /** The template new pages are written with. */
  template: string;
  count: number;
  today: PracticePage | null;
  /** Newest first, today excluded. */
  past: PracticePage[];
  /** Oldest first, ending today. */
  days: { dateISO: string; label: string; written: boolean }[];
  /** Today, so the client never has to work out the user's day itself. */
  todayISO: string;
  /** Rotates placeholders, stable for the day. */
  seed: number;
};

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
  /** Every minute ever sat, fractions included; the garden is drawn from it. */
  totalMinutes: number;
  sessions: number;
  /** Newest first. */
  recent: MeditationRow[];
  /** Oldest first, ending today. */
  days: { dateISO: string; label: string; minutes: number }[];
  todayISO: string;
  /** What the picker opens on: the last sitting's choice. */
  last: { kind: string; options: MeditationOptions } | null;
};

export type MindEnabled = {
  meditate: boolean;
  wishes: boolean;
  disputations: boolean;
  gratitude: boolean;
  dua: boolean;
};

export type MindView = {
  enabled: MindEnabled;
  active: WishCard[];
  settled: WishCard[];
  disputations: DisputationCard[];
  gratitude: PracticeView;
  dua: PracticeView;
  meditation: MeditationView;
};

export function mindEnabled(user: User): MindEnabled {
  return {
    wishes: user.mindWoopEnabled,
    disputations: user.mindDisputationEnabled,
    gratitude: user.mindGratitudeEnabled,
    dua: user.mindDuaEnabled,
    meditate: user.mindMeditationEnabled,
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

  const [wishes, disputations, pages, sitTotal, sittings] = await Promise.all([
    prisma.wish.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    }),
    prisma.disputation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.journalEntry.findMany({
      where: { userId: user.id, kind: { in: ["GRATITUDE", "DUA"] }, date: { gte: since } },
      orderBy: { date: "desc" },
      select: { id: true, date: true, kind: true, template: true, items: true, body: true },
    }),
    prisma.meditationSession.aggregate({
      where: { userId: user.id },
      _sum: { seconds: true },
      _count: true,
    }),
    prisma.meditationSession.findMany({
      where: { userId: user.id, startedAt: { gte: addDays(today, -HISTORY_DAYS) } },
      orderBy: { startedAt: "desc" },
      take: 200,
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

  const practice = (kind: PracticeKind, templateId: string, count: number): PracticeView => {
    const journalKind = kind === "gratitude" ? "GRATITUDE" : "DUA";
    const rows: PracticePage[] = pages
      .filter((row) => row.kind === journalKind)
      .map((row) => {
        const items = readItems(row.items);
        return {
          id: row.id,
          dateISO: toISODate(row.date),
          dateLabel: dayLabel.format(row.date),
          template: row.template ?? "",
          templateName: findTemplate(kind, row.template)?.name ?? "A page",
          // A page written before templates existed is just its body.
          items: items.length
            ? items
            : [{ key: "body", step: "", label: "", text: row.body }],
        };
      });
    const written = new Set(rows.map((row) => row.dateISO));
    return {
      template: templateOrDefault(kind, templateId).id,
      count: clampCount(count),
      today: rows.find((row) => row.dateISO === todayISO) ?? null,
      past: rows.filter((row) => row.dateISO !== todayISO),
      days: Array.from({ length: WEEK_DOTS }, (_, i) => {
        const date = addDays(today, i - WEEK_DOTS + 1);
        const iso = toISODate(date);
        return { dateISO: iso, label: dayLabel.format(date), written: written.has(iso) };
      }),
      todayISO,
      seed: Math.floor(today.getTime() / 86_400_000),
    };
  };

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
    totalMinutes: (sitTotal._sum.seconds ?? 0) / 60,
    sessions: sitTotal._count,
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

  return {
    enabled: mindEnabled(user),
    meditation,
    gratitude: practice("gratitude", user.gratitudeTemplate, user.gratitudeCount),
    dua: practice("dua", user.duaTemplate, user.duaCount),
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
    })),
  };
}
