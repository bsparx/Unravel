"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { addDays, todayLocal } from "@/lib/dates";
import { taskTitle } from "@/lib/brain-dump";
import { prisma } from "@/lib/db";
import { findMeditation, normalizeOptions, plannedSeconds } from "@/lib/meditations";
import {
  type ActionState,
  brainDumpSchema,
  cuid,
  disputationRevisitSchema,
  disputationSchema,
  fieldErrorsFrom,
  formValues,
  meditationSessionSchema,
  wishSchema,
  wishStatusSchema,
} from "@/lib/validation";

const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): ActionState => ({
  status: "error",
  message: "Some of that didn't look right.",
  fieldErrors: fieldErrorsFrom(error),
});

/** Create a wish, or rewrite one. Ids off the wire are always re-scoped. */
export async function saveWish(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = wishSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, wish, outcome, obstacle, plan } = parsed.data;

  if (id) {
    const { count } = await prisma.wish.updateMany({
      where: { id, userId: user.id },
      data: { wish, outcome, obstacle, plan },
    });
    if (count === 0) return { status: "error", message: "That wish no longer exists." };
  } else {
    await prisma.wish.create({
      data: {
        userId: user.id,
        wish,
        outcome,
        obstacle,
        plan,
        // Newest on top: the board sorts by this, descending.
        sortOrder: Date.now(),
      },
    });
  }

  revalidatePath("/mind");
  return { status: "success" };
}

/** Achieved, let go, or brought back. Settling stamps the moment. */
export async function setWishStatus(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = wishStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, status } = parsed.data;
  const { count } = await prisma.wish.updateMany({
    where: { id, userId: user.id },
    data: {
      status,
      settledAt: status === "ACTIVE" ? null : new Date(),
      // Brought back to the board, it goes to the top.
      ...(status === "ACTIVE" ? { sortOrder: Date.now() } : {}),
    },
  });
  if (count === 0) return { status: "error", message: "That wish no longer exists." };

  revalidatePath("/mind");
  return { status: "success" };
}

/**
 * Today's rehearsal of a wish: its outcome pictured, its obstacle named, its
 * if-then said. Once a day per wish; doing it again is a no-op. The day is
 * today in the user's own zone, never one sent by the client.
 */
export async function rehearseWish(id: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return { status: "error", message: "That wish no longer exists." };

  const wish = await prisma.wish.findFirst({
    where: { id: parsed.data, userId: user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!wish) return { status: "error", message: "That wish no longer exists." };

  const date = todayLocal(user.timezone);
  await prisma.wishRehearsal.upsert({
    where: { wishId_date: { wishId: wish.id, date } },
    create: { userId: user.id, wishId: wish.id, date },
    update: {},
  });

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deleteWish(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.wish.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}

/** Create a disputation, or rewrite one. Empty lenses are stored as null. */
export async function saveDisputation(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = disputationSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...input } = parsed.data;
  const data = {
    adversity: input.adversity,
    belief: input.belief,
    beliefBefore: input.beliefBefore ?? null,
    consequences: input.consequences,
    evidence: input.evidence || null,
    alternatives: input.alternatives || null,
    implications: input.implications || null,
    usefulness: input.usefulness || null,
    energization: input.energization,
    beliefAfter: input.beliefAfter ?? null,
  };

  if (id) {
    const { count } = await prisma.disputation.updateMany({
      where: { id, userId: user.id },
      data,
    });
    if (count === 0) return { status: "error", message: "That entry no longer exists." };
  } else {
    await prisma.disputation.create({ data: { userId: user.id, ...data } });
  }

  revalidatePath("/mind");
  return { status: "success" };
}

/**
 * Reread a disputation today, and say how strongly the old belief holds now.
 * Once a day per disputation; revisiting again the same day updates the rating.
 */
export async function revisitDisputation(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = disputationRevisitSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const entry = await prisma.disputation.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });
  if (!entry) return { status: "error", message: "That entry no longer exists." };

  const date = todayLocal(user.timezone);
  const belief = parsed.data.belief ?? null;
  await prisma.disputationRevisit.upsert({
    where: { disputationId_date: { disputationId: entry.id, date } },
    create: { userId: user.id, disputationId: entry.id, date, belief },
    update: { belief },
  });

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deleteDisputation(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.disputation.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}

/**
 * Keep a sitting. Called when a session finishes or is ended early; either
 * way the minutes sat are what's kept, and the garden grows by them.
 */
export async function saveMeditation(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = meditationSessionSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { kind, options, seconds, count, completed, startedAt } = parsed.data;
  const meditation = findMeditation(kind)!;

  await prisma.meditationSession.create({
    data: {
      userId: user.id,
      kind,
      options: normalizeOptions(meditation, options) as object,
      plannedSeconds: plannedSeconds(meditation, options),
      seconds,
      count: count ?? null,
      completed,
      startedAt,
    },
  });

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deleteMeditation(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.meditationSession.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}

// ---------------------------------------------------------------- brain dump

/**
 * Keep a brain dump: what was written (or only the day, when it was done on
 * paper), and the lines circled at the sort as todos. Everything goes in
 * undated, since a dump doesn't know when; a bedtime list is due tomorrow.
 * The day is today in the user's own zone.
 */
export async function saveBrainDump(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = brainDumpSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { kind, body, paper, seconds, tasks } = parsed.data;
  const date = todayLocal(user.timezone);
  const titles = tasks.map(taskTitle).filter(Boolean);
  const dueDate = kind === "TOMORROW" ? addDays(date, 1) : null;
  const now = Date.now();

  await prisma.$transaction([
    prisma.brainDump.create({
      data: {
        userId: user.id,
        date,
        kind,
        body: paper ? "" : body.trim(),
        paper,
        seconds: paper ? 0 : seconds,
        sent: titles.length,
      },
    }),
    ...(titles.length
      ? [
          prisma.task.createMany({
            data: titles.map((title, i) => ({
              userId: user.id,
              type: "TODO" as const,
              title,
              dueDate,
              // Lists sort ascending, so this keeps the order they were written in.
              sortOrder: now + i,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/mind");
  if (titles.length) {
    revalidatePath("/");
    revalidatePath("/day");
    revalidatePath("/tasks");
  }
  return { status: "success" };
}

export async function deleteBrainDump(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.brainDump.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}
