import type { User } from "@/lib/generated/prisma/client";
import { addDays, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { HeartEnabled } from "@/lib/heart-tabs";
import {
  clampCount,
  templateOrDefault,
  findTemplate,
  readItems,
  type PracticeKind,
  type PracticePage,
} from "@/lib/practices";
import {
  CUSTOM_PREFIX,
  readSet,
  sessionItem,
  type SessionItem,
  type SetItem,
} from "@/lib/recitations";
import { historySince, tend, type Tending } from "@/lib/tending";

/** How far back the journal on each daily tab reaches. */
const HISTORY_DAYS = 90;

export type PracticeView = {
  /** The template new pages are written with. */
  template: string;
  count: number;
  today: PracticePage | null;
  /** Newest first, today excluded. */
  past: PracticePage[];
  /** Today, so the client never has to work out the user's day itself. */
  todayISO: string;
  /** Rotates placeholders, stable for the day. */
  seed: number;
  /** The scene: a stage up for each day a page is written, down for each day without. */
  tending: Tending;
};

export type CustomRecitationRow = {
  id: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
};

export type RecitationView = {
  /** The oasis: a stage up for each day the whole set is recited, down for each day without. */
  tending: Tending;
  todayISO: string;
  /** The set as stored, cleaned (lib/recitations.ts `readSet`). */
  set: SetItem[];
  /** The set with its words, in order, ready for the reader. */
  items: SessionItem[];
  /** Your own recitations, live ones only. */
  customs: CustomRecitationRow[];
};

export type HeartView = {
  enabled: HeartEnabled;
  gratitude: PracticeView;
  dua: PracticeView;
  recitation: RecitationView;
};

/**
 * Gratitude and du'a kept the columns they had on Mind, so moving them here
 * lost nothing: same rows, same switches, same templates.
 */
export function heartEnabled(user: User): HeartEnabled {
  return {
    gratitude: user.mindGratitudeEnabled,
    dua: user.mindDuaEnabled,
    recitation: user.heartRecitationEnabled,
  };
}

/** One of your own recitations, as the reader takes it. */
function customItem(row: CustomRecitationRow, count: number): SessionItem {
  return {
    key: `${CUSTOM_PREFIX}${row.id}`,
    title: row.title,
    arabicTitle: "",
    ref: "Your own",
    hadith: [],
    rounds: count,
    parts: [{ count: 1, verses: [{ ar: row.arabic, tr: row.transliteration, en: row.translation }] }],
  };
}

/** Everything /heart shows, in one round trip. */
export async function getHeart(user: User): Promise<HeartView> {
  const today = todayLocal(user.timezone);
  const since = addDays(today, -HISTORY_DAYS);

  // A scene is kept by every day since the practice began (lib/tending.ts),
  // so the days it was done are read all the way back: dates only.
  const [pages, pageDays, recitedDays, customs] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id, kind: { in: ["GRATITUDE", "DUA"] }, date: { gte: since } },
      orderBy: { date: "desc" },
      select: { id: true, date: true, kind: true, template: true, items: true, body: true },
    }),
    prisma.journalEntry.findMany({
      where: { userId: user.id, kind: { in: ["GRATITUDE", "DUA"] } },
      select: { date: true, kind: true },
    }),
    prisma.recitationLog.findMany({
      where: { userId: user.id },
      select: { date: true },
    }),
    prisma.customRecitation.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, arabic: true, transliteration: true, translation: true },
    }),
  ]);

  // `date` is a calendar day stored at UTC midnight, so it's labelled in UTC.
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const label = (date: Date) => dayLabel.format(date);
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
          items: items.length ? items : [{ key: "body", step: "", label: "", text: row.body }],
        };
      });
    const written = pageDays.filter((row) => row.kind === journalKind).map((row) => toISODate(row.date));
    return {
      tending: tend(historySince(todayISO, written, label)),
      template: templateOrDefault(kind, templateId).id,
      count: clampCount(count),
      today: rows.find((row) => row.dateISO === todayISO) ?? null,
      past: rows.filter((row) => row.dateISO !== todayISO),
      todayISO,
      seed: Math.floor(today.getTime() / 86_400_000),
    };
  };

  const customById = new Map(customs.map((row) => [row.id, row]));
  const set = readSet(user.recitationSet, new Set(customById.keys()));
  const items = set.flatMap((item) => {
    if (item.key.startsWith(CUSTOM_PREFIX)) {
      const row = customById.get(item.key.slice(CUSTOM_PREFIX.length));
      return row ? [customItem(row, item.count)] : [];
    }
    const found = sessionItem(item);
    return found ? [found] : [];
  });

  return {
    enabled: heartEnabled(user),
    gratitude: practice("gratitude", user.gratitudeTemplate, user.gratitudeCount),
    dua: practice("dua", user.duaTemplate, user.duaCount),
    recitation: {
      tending: tend(historySince(todayISO, recitedDays.map((row) => toISODate(row.date)), label)),
      todayISO,
      set,
      items,
      customs,
    },
  };
}
