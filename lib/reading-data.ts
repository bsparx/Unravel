import type { User } from "@/lib/generated/prisma/client";
import { addDays, diffInDays, toISODate, toLocalDate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { STRIP_DAYS, historySince, tend, type Tending } from "@/lib/tending";
import {
  endOf,
  pagesRead,
  positionLabel,
  positionOf,
  progressOf,
  type BookStatus,
  type ReadingUnit,
} from "@/lib/reading";

/** Two weeks, as on the other daily tabs. */
const WEEK_DOTS = 14;

/** What a dialog needs to log a reading against a book. */
export type LogBook = {
  id: string;
  title: string;
  author: string | null;
  cover: string;
  unit: ReadingUnit;
  totalPages: number | null;
  startPage: number;
  /** Where you are now. */
  position: number;
  status: BookStatus;
};

export type ShelfBook = LogBook & {
  progress: number | null;
  positionLabel: string;
  /** "Today", "Yesterday", "Tue 17 Nov", or null before the first reading. */
  lastRead: string | null;
  readings: number;
  /** "Finished 12 Oct" style date, for the Read shelf. */
  finishedLabel: string | null;
};

export type ReadingDay = {
  dateISO: string;
  label: string;
  pages: number;
  percent: number;
  /** Any reading at all, notes-only included. */
  read: boolean;
};

export type ReadingView = {
  reading: ShelfBook[];
  upNext: ShelfBook[];
  finished: ShelfBook[];
  setAside: ShelfBook[];
  /** Oldest first, ending today. */
  days: ReadingDay[];
  todayISO: string;
  week: { pages: number; percent: number };
  /** The library: a stage up for each day you read, down for each day you don't. */
  tending: Tending;
};

export type BookLog = {
  id: string;
  dateISO: string;
  /** "Tue 17 Nov". */
  dateLabel: string;
  fromPage: number;
  toPage: number;
  /** Optional minutes tracked by the user; null assumes 10 min in stats. */
  minutes: number | null;
  note: string | null;
  quote: string | null;
  quotePage: number | null;
  createdAt: string;
};

export type BookView = {
  book: ShelfBook & {
    summary: string | null;
    startedLabel: string | null;
    /** Pages (or percent) read across every reading. */
    covered: number;
  };
  logs: BookLog[];
  todayISO: string;
};

// `date` is a calendar day stored at UTC midnight, so it's labelled in UTC.
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function lastReadLabel(date: Date | null, today: Date): string | null {
  if (!date) return null;
  const ago = diffInDays(today, date);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  return dayLabel.format(date);
}

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  cover: string;
  unit: ReadingUnit;
  totalPages: number | null;
  startPage: number;
  status: BookStatus;
  finishedAt: Date | null;
};

function shelfBook(
  row: BookRow,
  stats: { furthest: number | null; last: Date | null; count: number },
  today: Date,
  instantLabel: Intl.DateTimeFormat,
): ShelfBook {
  const position = positionOf(row, stats.furthest === null ? [] : [{ fromPage: 0, toPage: stats.furthest }]);
  // A finished book with no reading that reached the end still reads as done.
  const shown = row.status === "FINISHED" ? Math.max(position, endOf(row) ?? position) : position;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    cover: row.cover,
    unit: row.unit,
    totalPages: row.totalPages,
    startPage: row.startPage,
    status: row.status,
    position,
    progress: progressOf(row, shown),
    positionLabel: positionLabel(row, position),
    lastRead: lastReadLabel(stats.last, today),
    readings: stats.count,
    finishedLabel: row.finishedAt ? instantLabel.format(row.finishedAt) : null,
  };
}

const BOOK_SELECT = {
  id: true,
  title: true,
  author: true,
  cover: true,
  unit: true,
  totalPages: true,
  startPage: true,
  status: true,
  finishedAt: true,
} as const;

/** The Reading tab: every shelf, two weeks of dots and this week's pages. */
export async function getReading(user: User): Promise<ReadingView> {
  const today = todayLocal(user.timezone);
  // Two weeks and today, for the dots and the week's pages.
  const since = addDays(today, -STRIP_DAYS);
  const instantLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: user.timezone,
  });

  const [books, stats, recent, readDays] = await Promise.all([
    prisma.book.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      select: BOOK_SELECT,
    }),
    prisma.readingLog.groupBy({
      by: ["bookId"],
      where: { userId: user.id },
      _max: { toPage: true, date: true },
      _count: { _all: true },
    }),
    prisma.readingLog.findMany({
      where: { userId: user.id, date: { gte: since } },
      select: { date: true, fromPage: true, toPage: true, book: { select: { unit: true } } },
    }),
    // Every day ever read, for the library: it's kept by all of them (lib/tending.ts).
    prisma.readingLog.findMany({
      where: { userId: user.id },
      distinct: ["date"],
      select: { date: true },
    }),
  ]);

  const byBook = new Map(stats.map((row) => [row.bookId, row]));
  const shelf = books.map((row) => {
    const stat = byBook.get(row.id);
    return {
      row,
      book: shelfBook(
        row,
        { furthest: stat?._max.toPage ?? null, last: stat?._max.date ?? null, count: stat?._count._all ?? 0 },
        today,
        instantLabel,
      ),
    };
  });

  const days = new Map<string, ReadingDay>();
  for (let i = 0; i <= STRIP_DAYS; i += 1) {
    const date = addDays(since, i);
    const iso = toISODate(date);
    days.set(iso, { dateISO: iso, label: dayLabel.format(date), pages: 0, percent: 0, read: false });
  }
  for (const log of recent) {
    const day = days.get(toISODate(log.date));
    if (!day) continue;
    day.read = true;
    if (log.book.unit === "PERCENT") day.percent += pagesRead(log);
    else day.pages += pagesRead(log);
  }
  const history = [...days.values()];
  const ordered = history.slice(-WEEK_DOTS);
  const lastWeek = ordered.slice(-7);

  const finished = shelf
    .filter(({ row }) => row.status === "FINISHED")
    .sort((a, b) => (b.row.finishedAt?.getTime() ?? 0) - (a.row.finishedAt?.getTime() ?? 0))
    .map(({ book }) => book);

  return {
    reading: shelf.filter(({ row }) => row.status === "READING").map(({ book }) => book),
    // The queue reads first-added first.
    upNext: shelf.filter(({ row }) => row.status === "UP_NEXT").map(({ book }) => book).reverse(),
    finished,
    setAside: shelf.filter(({ row }) => row.status === "SET_ASIDE").map(({ book }) => book),
    days: ordered,
    todayISO: toISODate(today),
    week: {
      pages: lastWeek.reduce((sum, day) => sum + day.pages, 0),
      percent: lastWeek.reduce((sum, day) => sum + day.percent, 0),
    },
    tending: tend(
      historySince(
        toISODate(today),
        readDays.map((row) => toISODate(row.date)),
        (date) => dayLabel.format(date),
      ),
    ),
  };
}

/**
 * When you started: the day you put it on the shelf, unless a reading was
 * filed for an earlier day (logging yesterday's pages the day you add it).
 */
function startedLabel(started: Date, firstReading: Date | null, timeZone: string): string {
  const startedDay = toLocalDate(started, timeZone);
  const day = firstReading && firstReading < startedDay ? firstReading : startedDay;
  return dayYearLabel.format(day);
}

// A calendar day at UTC midnight, with its year.
const dayYearLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One book and all its readings, for its notebook page. Null if it isn't yours. */
export async function getBook(user: User, id: string): Promise<BookView | null> {
  const row = await prisma.book.findFirst({
    where: { id, userId: user.id },
    select: { ...BOOK_SELECT, summary: true, startedAt: true, createdAt: true },
  });
  if (!row) return null;

  const logs = await prisma.readingLog.findMany({
    where: { bookId: row.id, userId: user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const today = todayLocal(user.timezone);
  const instantLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: user.timezone,
  });

  const furthest = logs.length ? Math.max(...logs.map((log) => log.toPage)) : null;
  const book = shelfBook(row, { furthest, last: logs[0]?.date ?? null, count: logs.length }, today, instantLabel);

  return {
    book: {
      ...book,
      summary: row.summary,
      startedLabel: startedLabel(row.startedAt ?? row.createdAt, logs.at(-1)?.date ?? null, user.timezone),
      covered: logs.reduce((sum, log) => sum + pagesRead(log), 0),
    },
    logs: logs.map((log) => ({
      id: log.id,
      dateISO: toISODate(log.date),
      dateLabel: dayLabel.format(log.date),
      fromPage: log.fromPage,
      toPage: log.toPage,
      minutes: log.minutes,
      note: log.note,
      quote: log.quote,
      quotePage: log.quotePage,
      createdAt: log.createdAt.toISOString(),
    })),
    todayISO: toISODate(today),
  };
}
