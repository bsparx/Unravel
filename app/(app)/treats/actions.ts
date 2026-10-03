"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { chapterSchema, cuid, logObjectiveSchema, treatSchema } from "@/lib/validation";

type Result = { ok: true } | { ok: false; message: string };

const firstIssue = (error: { issues: { message: string }[] }) =>
  error.issues[0]?.message ?? "That didn't look right.";

export async function createTreat(input: {
  name: string;
  identityId: string | null;
  votesNeeded: number;
}): Promise<Result> {
  const user = await requireUser();
  const parsed = treatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  let identityId: string | null = null;
  if (parsed.data.identityId) {
    const owned = await prisma.identity.findFirst({
      where: { id: parsed.data.identityId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { ok: false, message: "That identity isn't yours." };
    identityId = owned.id;
  }

  await prisma.treat.create({
    data: { userId: user.id, name: parsed.data.name, identityId, votesNeeded: parsed.data.votesNeeded },
  });
  revalidatePath("/treats");
  return { ok: true };
}

/** Enjoy a treat, or take it back. Nothing is spent either way. */
export async function toggleTreat(treatId: string, enjoyed: boolean): Promise<Result> {
  const user = await requireUser();
  if (!cuid.safeParse(treatId).success) return { ok: false, message: "That didn't look right." };
  const { count } = await prisma.treat.updateMany({
    where: { id: treatId, userId: user.id },
    data: { enjoyedAt: enjoyed ? new Date() : null },
  });
  if (count === 0) return { ok: false, message: "That treat isn't yours." };
  revalidatePath("/treats");
  return { ok: true };
}

export async function deleteTreat(treatId: string): Promise<Result> {
  const user = await requireUser();
  if (!cuid.safeParse(treatId).success) return { ok: false, message: "That didn't look right." };
  await prisma.treat.deleteMany({ where: { id: treatId, userId: user.id } });
  revalidatePath("/treats");
  return { ok: true };
}

export async function createChapter(input: {
  identityId: string;
  title: string;
  intro?: string | null;
  lengthDays: number;
  reward?: string | null;
  objectives: { text: string; target: number; habitId?: string | null }[];
}): Promise<Result> {
  const user = await requireUser();
  const parsed = chapterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const [identity, habits] = await Promise.all([
    prisma.identity.findFirst({ where: { id: parsed.data.identityId, userId: user.id }, select: { id: true } }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        type: "HABIT",
        id: { in: parsed.data.objectives.flatMap((objective) => (objective.habitId ? [objective.habitId] : [])) },
      },
      select: { id: true },
    }),
  ]);
  if (!identity) return { ok: false, message: "That identity isn't yours." };
  const owned = new Set(habits.map((habit) => habit.id));

  await prisma.chapter.create({
    data: {
      userId: user.id,
      identityId: identity.id,
      title: parsed.data.title,
      intro: parsed.data.intro ?? null,
      reward: parsed.data.reward ?? null,
      lengthDays: parsed.data.lengthDays,
      startDate: todayLocal(user.timezone),
      objectives: {
        create: parsed.data.objectives.map((objective, position) => ({
          text: objective.text,
          target: objective.target,
          habitId: objective.habitId && owned.has(objective.habitId) ? objective.habitId : null,
          position,
        })),
      },
    },
  });
  revalidatePath("/treats");
  return { ok: true };
}

/** Log one more (or one fewer) for a manual objective. Never below zero. */
export async function logObjective(objectiveId: string, delta: 1 | -1): Promise<Result> {
  const user = await requireUser();
  const parsed = logObjectiveSchema.safeParse({ objectiveId, delta });
  if (!parsed.success) return { ok: false, message: "That didn't look right." };

  const objective = await prisma.chapterObjective.findFirst({
    where: { id: parsed.data.objectiveId, habitId: null, chapter: { userId: user.id, completedAt: null } },
    select: { id: true, logged: true, target: true },
  });
  if (!objective) return { ok: false, message: "That objective isn't open." };

  await prisma.chapterObjective.update({
    where: { id: objective.id },
    data: { logged: Math.max(0, Math.min(objective.target, objective.logged + parsed.data.delta)) },
  });
  revalidatePath("/treats");
  return { ok: true };
}

/** Close a chapter: finished, or set down early. Either way it stays in the record. */
export async function closeChapter(chapterId: string): Promise<Result> {
  const user = await requireUser();
  if (!cuid.safeParse(chapterId).success) return { ok: false, message: "That didn't look right." };
  const { count } = await prisma.chapter.updateMany({
    where: { id: chapterId, userId: user.id, completedAt: null },
    data: { completedAt: new Date() },
  });
  if (count === 0) return { ok: false, message: "That chapter is already closed." };
  revalidatePath("/treats");
  return { ok: true };
}
