"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { startRecoverySession } from "@/app/(app)/timer/actions";
import { requireUser } from "@/lib/auth";
import { closeStepHref, nextCloseStep } from "@/lib/close-ritual";
import { addDays, parseLocalDate, todayLocal } from "@/lib/dates";
import { markDayClosed, setSelectedTask } from "@/lib/day-log";
import { prisma } from "@/lib/db";
import { parseQuickAdd } from "@/lib/quick-parse";
import { journalSchema, selectOneThingSchema } from "@/lib/validation";
import type { JournalKind } from "@/lib/generated/prisma/client";

/**
 * The close.
 *
 * Every step writes on advance rather than at the end. Bailing out halfway
 * keeps everything you already entered — there is no final submit holding the
 * four hostage, because a ritual you can only complete perfectly is a ritual
 * you stop doing.
 */

/** Step 1 — tomorrow's one thing. Closes the loop with the morning pass. */
export async function setTomorrowOneThing(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tomorrow = addDays(todayLocal(user.timezone), 1);

  const parsed = selectOneThingSchema.safeParse({
    date: formData.get("date"),
    taskId: formData.get("taskId") || undefined,
    captureId: formData.get("captureId") || undefined,
    title: formData.get("title") || undefined,
  });

  if (parsed.success) {
    const date = parseLocalDate(parsed.data.date) ?? tomorrow;
    const taskId = await resolveTask(user.id, parsed.data, date);
    if (taskId) await setSelectedTask(user.id, date, taskId);
  }

  advance("one-thing");
}

/** Step 2 — the worry dump. */
export async function saveWorry(formData: FormData): Promise<void> {
  await saveJournal(formData, "WORRY");
  advance("worry");
}

/** Step 3 — the gratitude line. */
export async function saveGratitude(formData: FormData): Promise<void> {
  await saveJournal(formData, "GRATITUDE");
  advance("gratitude");
}

/**
 * Step 4 — the hand-off.
 *
 * Marks the day closed and starts recovery *server-side*, so the last thing
 * that happens is the timer already running rather than another button.
 */
export async function handOff(): Promise<void> {
  const user = await requireUser();

  await markDayClosed(user.id, todayLocal(user.timezone));
  await startRecoverySession();

  revalidatePath("/");
  redirect("/timer");
}

/** Leave without finishing. Everything entered so far is already saved. */
export async function bailOut(): Promise<void> {
  redirect("/");
}

// ---------------------------------------------------------------- internals

function advance(from: Parameters<typeof nextCloseStep>[0]) {
  const next = nextCloseStep(from);
  revalidatePath("/close");
  redirect(next ? closeStepHref(next) : "/");
}

async function saveJournal(
  formData: FormData,
  kind: JournalKind,
): Promise<void> {
  const user = await requireUser();
  const parsed = journalSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return;

  const date = todayLocal(user.timezone);
  const body = parsed.data.body;

  // An empty answer is a real answer — "nothing is worrying me tonight". It
  // removes the row rather than storing a blank one.
  if (body.length === 0) {
    await prisma.journalEntry.deleteMany({
      where: { userId: user.id, date, kind },
    });
    return;
  }

  await prisma.journalEntry.upsert({
    where: { userId_date_kind: { userId: user.id, date, kind } },
    create: { userId: user.id, date, kind, body },
    update: { body },
  });
}

async function resolveTask(
  userId: string,
  input: { taskId?: string; captureId?: string; title?: string },
  date: Date,
): Promise<string | null> {
  if (input.taskId) {
    const owned = await prisma.task.findFirst({
      where: { id: input.taskId, userId },
      select: { id: true },
    });
    return owned?.id ?? null;
  }

  if (input.captureId) {
    const capture = await prisma.capture.findFirst({
      where: { id: input.captureId, userId },
    });
    if (!capture) return null;
    if (capture.promotedTaskId) return capture.promotedTaskId;

    const { title, minutes, priority } = parseQuickAdd(capture.body);
    const task = await prisma.task.create({
      data: {
        userId,
        type: "TODO",
        title: (title || capture.body).slice(0, 200),
        priority,
        estimatedSeconds: minutes ? minutes * 60 : null,
        dueDate: date,
        sortOrder: Date.now(),
      },
    });

    await prisma.capture.update({
      where: { id: capture.id },
      data: { status: "PROMOTED", promotedTaskId: task.id },
    });

    return task.id;
  }

  if (input.title) {
    const task = await prisma.task.create({
      data: {
        userId,
        type: "TODO",
        title: input.title.slice(0, 200),
        dueDate: date,
        sortOrder: Date.now(),
      },
    });
    return task.id;
  }

  return null;
}
