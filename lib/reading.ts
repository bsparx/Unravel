/**
 * Reading: the shelf, where you are in each book, and the notes it gathers.
 *
 * Pure on purpose, so verify-logic can check it and server and client agree.
 * Where you are in a book is never stored; it's worked out here from where
 * you started and how far each reading got.
 */

export type ReadingUnit = "PAGE" | "PERCENT";
export type BookStatus = "READING" | "UP_NEXT" | "FINISHED" | "SET_ASIDE";

export const BOOK_TITLE_MAX = 200;
export const BOOK_AUTHOR_MAX = 120;
export const BOOK_PAGES_MAX = 20_000;
export const READING_NOTE_MAX = 5000;
export const READING_QUOTE_MAX = 1000;
export const BOOK_SUMMARY_MAX = 20_000;

/**
 * Cloth bindings. A cover is a physical object, like the journal paper, so
 * it's the same colour in both themes. `ink` is the title, `foil` the
 * stamped rule and author. Each pair is AA on its cloth.
 */
export const BOOK_COVERS = {
  oxblood: { name: "Oxblood", cloth: "#6e2430", ink: "#f6e6d8", foil: "#e3b67a" },
  forest: { name: "Forest", cloth: "#23493b", ink: "#eef0e2", foil: "#d8c27a" },
  navy: { name: "Navy", cloth: "#1f2f57", ink: "#eef1f8", foil: "#d9bd7c" },
  ochre: { name: "Ochre", cloth: "#b97a1f", ink: "#2a1c08", foil: "#3d2a0c" },
  plum: { name: "Plum", cloth: "#4f2a55", ink: "#f5e9f4", foil: "#e6b9d6" },
  teal: { name: "Teal", cloth: "#1d5c63", ink: "#e8f6f4", foil: "#f0cf8a" },
  slate: { name: "Slate", cloth: "#46505c", ink: "#f1f3f5", foil: "#cdd6e0" },
  rose: { name: "Rose", cloth: "#c7707a", ink: "#2c1216", foil: "#4a1d24" },
  moss: { name: "Moss", cloth: "#6b7a3a", ink: "#f6f5e4", foil: "#f1e3a6" },
  ink: { name: "Ink", cloth: "#1c1b22", ink: "#f2efe6", foil: "#c9a96a" },
  sky: { name: "Sky", cloth: "#8fb3d1", ink: "#14263a", foil: "#1f3a58" },
  sand: { name: "Sand", cloth: "#d9c6a0", ink: "#2b2418", foil: "#6b4f22" },
} as const;

export type BookCover = keyof typeof BOOK_COVERS;
export const BOOK_COVER_KEYS = Object.keys(BOOK_COVERS) as BookCover[];

export function isBookCover(value: string): value is BookCover {
  return Object.hasOwn(BOOK_COVERS, value);
}

/** A cover for a new book, stable for its title, so the preview doesn't flicker. */
export function coverFor(title: string): BookCover {
  let hash = 0;
  for (const char of title.trim().toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BOOK_COVER_KEYS[hash % BOOK_COVER_KEYS.length];
}

export function coverOf(key: string) {
  return isBookCover(key) ? BOOK_COVERS[key] : BOOK_COVERS.slate;
}

type Positioned = { unit: ReadingUnit; totalPages: number | null; startPage: number };
type Ranged = { fromPage: number; toPage: number };

/** The last page there is: 100 for an e-book, the page count, or unknown. */
export function endOf(book: Pick<Positioned, "unit" | "totalPages">): number | null {
  return book.unit === "PERCENT" ? 100 : book.totalPages;
}

/** Where you are: the furthest any reading reached, or where you started. */
export function positionOf(book: Positioned, logs: readonly Ranged[]): number {
  return logs.reduce((furthest, log) => Math.max(furthest, log.toPage), book.startPage);
}

/** 0..1 through the book, or null when the length isn't known. */
export function progressOf(book: Positioned, position: number): number | null {
  const end = endOf(book);
  if (!end) return null;
  return Math.min(1, Math.max(0, position / end));
}

export function pagesRead(log: Ranged): number {
  return Math.max(0, log.toPage - log.fromPage);
}

/** "pp. 34–58", "p. 34", "12–20%" or "12%". */
export function rangeLabel(unit: ReadingUnit, from: number, to: number): string {
  if (unit === "PERCENT") return from === to ? `${to}%` : `${from}–${to}%`;
  return from === to ? `p. ${to}` : `pp. ${from}–${to}`;
}

/** "p. 142 of 499", "p. 142", "28%", or "Not started". */
export function positionLabel(book: Positioned, position: number): string {
  if (book.unit === "PERCENT") return `${position}%`;
  if (position === 0) return book.totalPages ? `${book.totalPages} pages` : "Not started";
  return book.totalPages ? `p. ${position} of ${book.totalPages}` : `p. ${position}`;
}

/** "24 pages", "1 page", "8%". */
export function amountLabel(unit: ReadingUnit, amount: number): string {
  if (unit === "PERCENT") return `${amount}%`;
  return `${amount} ${amount === 1 ? "page" : "pages"}`;
}

/**
 * The notebook reads front to back, the way the book does, not in the order
 * the days fell. Ties (two readings of the same pages) go by date, then by
 * when they were written.
 */
export function notesInOrder<T extends Ranged & { dateISO: string; createdAt: string }>(logs: readonly T[]): T[] {
  return [...logs].sort(
    (a, b) =>
      a.fromPage - b.fromPage ||
      a.toPage - b.toPage ||
      a.dateISO.localeCompare(b.dateISO) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** Newest first: the diary view of the same notes. */
export function notesByDate<T extends { dateISO: string; createdAt: string }>(logs: readonly T[]): T[] {
  return [...logs].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt));
}

export type MarkdownLog = Ranged & {
  dateISO: string;
  createdAt: string;
  note: string | null;
  quote: string | null;
  quotePage: number | null;
};

/** The whole notebook as Markdown, for "Copy notes". */
export function toMarkdown(
  book: { title: string; author: string | null; unit: ReadingUnit; summary: string | null },
  logs: readonly MarkdownLog[],
): string {
  const lines: string[] = [`# ${book.title}`];
  if (book.author) lines.push(`*${book.author}*`);
  if (book.summary?.trim()) lines.push("", "## In my own words", "", book.summary.trim());

  const written = notesInOrder(logs).filter((log) => log.note?.trim() || log.quote?.trim());
  if (written.length) {
    lines.push("", "## Notes");
    for (const log of written) {
      lines.push("", `### ${rangeLabel(book.unit, log.fromPage, log.toPage)}`);
      if (log.note?.trim()) lines.push("", log.note.trim());
      if (log.quote?.trim()) {
        lines.push("", ...log.quote.trim().split("\n").map((line) => `> ${line}`));
        if (log.quotePage !== null) {
          lines.push(`> — ${book.unit === "PERCENT" ? `${log.quotePage}%` : `p. ${log.quotePage}`}`);
        }
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  READING: "Reading",
  UP_NEXT: "Up next",
  FINISHED: "Finished",
  SET_ASIDE: "Set aside",
};

/** Placeholders for the note, rotated so the box doesn't ask the same thing every day. */
export const NOTE_PROMPTS = [
  "An idea you want to remember…",
  "What happened, in a sentence or two…",
  "Something you'd argue with…",
  "What it made you think of…",
  "A question it left you with…",
  "What you'd tell a friend about these pages…",
] as const;

/**
 * A reading's pages against its book: null when they fit, else what to say.
 * The schema checks the shape; this needs the book, so the action runs it.
 */
export function checkLogRange(
  book: Pick<Positioned, "unit" | "totalPages">,
  log: Ranged & { quotePage?: number | null },
): string | null {
  const end = endOf(book);
  const word = book.unit === "PERCENT" ? "100%" : `page ${end}`;
  if (log.toPage < log.fromPage) return "Where you stopped comes after where you started.";
  if (end !== null && log.toPage > end) return `The book ends at ${word}.`;
  if (end !== null && log.fromPage > end) return `The book ends at ${word}.`;
  if (log.quotePage != null && end !== null && log.quotePage > end) return `That line can't be past ${word}.`;
  return null;
}

/** How far back a reading can be filed. Further than this is a typo. */
export const READING_BACKDATE_DAYS = 366;

/** A reading's day against the user's today (both "YYYY-MM-DD"). */
export function checkLogDate(dateISO: string, todayISO: string, earliestISO: string): string | null {
  if (dateISO > todayISO) return "That day hasn't happened yet.";
  if (dateISO < earliestISO) return "That's more than a year ago.";
  return null;
}
