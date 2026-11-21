"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { addDays, parseLocalDate, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { READING_BACKDATE_DAYS, checkLogDate, checkLogRange, endOf } from "@/lib/reading";
import {
  type ActionState,
  bookSchema,
  bookStatusSchema,
  bookSummarySchema,
  cuid,
  fieldErrorsFrom,
  formValues,
  readingLogSchema,
} from "@/lib/validation";

const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): ActionState => {
  const fieldErrors = fieldErrorsFrom(error);
  return {
    status: "error",
    // The first field's own words read better in a toast than a generic line.
    message: Object.values(fieldErrors)[0] ?? "Some of that didn't look right.",
    fieldErrors,
  };
};

const refresh = (bookId?: string) => {
  revalidatePath("/mind");
  revalidatePath("/stats");
  if (bookId) revalidatePath(`/mind/books/${bookId}`);
};

export type SaveBookState = ActionState & { id?: string };

/** Add a book to a shelf, or edit one. Ids off the wire are always re-scoped. */
export async function saveBook(formData: FormData): Promise<SaveBookState> {
  const user = await requireUser();
  const parsed = bookSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, title, author, unit, totalPages, startPage, cover, status } = parsed.data;
  const data = {
    title,
    author: author || null,
    unit,
    // A percent book always runs to 100; a length typed before switching is dropped.
    totalPages: unit === "PERCENT" ? null : (totalPages ?? null),
    startPage: startPage ?? 0,
    cover,
  };

  if (id) {
    const existing = await prisma.book.findFirst({
      where: { id, userId: user.id },
      select: { id: true, logs: { select: { fromPage: true, toPage: true, quotePage: true } } },
    });
    if (!existing) return { status: "error", message: "That book is no longer on your shelf." };
    // A shorter length can't strand readings past its end.
    const stranded = existing.logs.find((log) => checkLogRange(data, log) !== null);
    if (stranded) {
      const end = endOf(data);
      return {
        status: "error",
        message: `A reading already reaches ${unit === "PERCENT" ? `${stranded.toPage}%` : `page ${stranded.toPage}`}, past ${unit === "PERCENT" ? "100%" : `page ${end}`}.`,
        fieldErrors: { totalPages: "Some readings go past this." },
      };
    }
    await prisma.book.update({ where: { id }, data });
    refresh(id);
    return { status: "success", id };
  }

  const reading = (status ?? "READING") === "READING";
  const created = await prisma.book.create({
    data: {
      userId: user.id,
      ...data,
      status: reading ? "READING" : "UP_NEXT",
      startedAt: reading ? new Date() : null,
      // Newest first on the shelf, which sorts by this, descending.
      sortOrder: Date.now(),
    },
    select: { id: true },
  });
  refresh();
  return { status: "success", id: created.id };
}

/**
 * Move a book between shelves. Finishing stamps the day; starting a book
 * from Up next stamps when you began, and puts it at the front of the shelf.
 */
export async function setBookStatus(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = bookStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, status } = parsed.data;
  const book = await prisma.book.findFirst({ where: { id, userId: user.id }, select: { status: true, startedAt: true } });
  if (!book) return { status: "error", message: "That book is no longer on your shelf." };

  await prisma.book.update({
    where: { id },
    data: {
      status,
      finishedAt: status === "FINISHED" ? new Date() : null,
      ...(status === "READING"
        ? { sortOrder: Date.now(), ...(book.startedAt ? {} : { startedAt: new Date() }) }
        : {}),
    },
  });
  refresh(id);
  return { status: "success" };
}

/** "In your own words." An empty summary is cleared, not stored blank. */
export async function saveBookSummary(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = bookSummarySchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, summary } = parsed.data;
  const { count } = await prisma.book.updateMany({
    where: { id, userId: user.id },
    data: { summary: summary || null },
  });
  if (count === 0) return { status: "error", message: "That book is no longer on your shelf." };
  refresh(id);
  return { status: "success" };
}

/** A book and every reading of it. */
export async function deleteBook(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.book.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
  revalidatePath("/stats");
}

export type SaveLogState = ActionState & { finished?: boolean };

/**
 * Log a reading, or fix one. Its pages are checked against the book and its
 * day against the user's own today. Ticking "finished" moves the book to
 * the Read shelf in the same breath.
 */
export async function saveReadingLog(formData: FormData): Promise<SaveLogState> {
  const user = await requireUser();
  const parsed = readingLogSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, bookId, date, fromPage, toPage, minutes, note, quote, quotePage, finished } = parsed.data;

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId: user.id },
    select: { id: true, unit: true, totalPages: true, status: true, startedAt: true },
  });
  if (!book) return { status: "error", message: "That book is no longer on your shelf." };

  const rangeError = checkLogRange(book, { fromPage, toPage, quotePage: quotePage ?? null });
  if (rangeError) return { status: "error", message: rangeError, fieldErrors: { toPage: rangeError } };

  const today = todayLocal(user.timezone);
  const dateError = checkLogDate(date, toISODate(today), toISODate(addDays(today, -READING_BACKDATE_DAYS)));
  const day = parseLocalDate(date);
  if (dateError || !day) {
    const message = dateError ?? "Pick a day.";
    return { status: "error", message, fieldErrors: { date: message } };
  }

  const data = {
    date: day,
    fromPage,
    toPage,
    minutes: minutes ?? null,
    note: note || null,
    quote: quote || null,
    // A page with no line to go with it means nothing.
    quotePage: quote ? (quotePage ?? null) : null,
  };

  if (id) {
    const { count } = await prisma.readingLog.updateMany({ where: { id, userId: user.id, bookId }, data });
    if (count === 0) return { status: "error", message: "That reading no longer exists." };
  } else {
    await prisma.readingLog.create({ data: { userId: user.id, bookId, ...data } });
  }

  const finishing = finished && book.status !== "FINISHED";
  if (finishing) {
    await prisma.book.update({ where: { id: bookId }, data: { status: "FINISHED", finishedAt: new Date() } });
  } else if (!id && book.status !== "READING" && book.status !== "FINISHED") {
    // Reading a book from Up next or Set aside puts it back on the shelf.
    await prisma.book.update({
      where: { id: bookId },
      data: { status: "READING", sortOrder: Date.now(), ...(book.startedAt ? {} : { startedAt: new Date() }) },
    });
  }

  refresh(bookId);
  return { status: "success", finished: Boolean(finishing) };
}

export async function deleteReadingLog(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  const log = await prisma.readingLog.findFirst({ where: { id: parsed.data, userId: user.id }, select: { bookId: true } });
  if (!log) return;
  await prisma.readingLog.deleteMany({ where: { id: parsed.data, userId: user.id } });
  refresh(log.bookId);
}
