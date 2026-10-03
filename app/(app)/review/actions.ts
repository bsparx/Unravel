"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { reviewWeekStart } from "@/lib/review-week";
import { weeklyReviewSchema } from "@/lib/validation";

type Result = { ok: true } | { ok: false; message: string };

/**
 * Close the weekly council: the week's lead, its sentence, and (optionally) a
 * smaller minimum for the quiet habit. One upsert per week, so holding it
 * again simply revises the plan. Quota changes never rewrite past days: a
 * day's tier is stored on its occurrence.
 */
export async function closeReview(input: {
  leadIdentityId: string | null;
  statement?: string | null;
  habitId?: string | null;
  newMinimum?: string | null;
}): Promise<Result> {
  const user = await requireUser();
  const parsed = weeklyReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That didn't look right." };
  const { leadIdentityId, statement, habitId, newMinimum } = parsed.data;

  const [lead, habit] = await Promise.all([
    leadIdentityId
      ? prisma.identity.findFirst({ where: { id: leadIdentityId, userId: user.id }, select: { id: true } })
      : null,
    habitId && newMinimum
      ? prisma.task.findFirst({
          where: { id: habitId, userId: user.id, type: "HABIT" },
          select: { id: true, title: true, recurrence: { select: { minimalTask: true } } },
        })
      : null,
  ]);
  if (leadIdentityId && !lead) return { ok: false, message: "That identity isn't yours." };

  const changed = habit?.recurrence && newMinimum && newMinimum !== habit.recurrence.minimalTask;
  const adjustment = changed ? `${habit.title}: the minimum is now "${newMinimum}".` : null;
  const weekStart = reviewWeekStart(todayLocal(user.timezone), user.weekStart);

  await prisma.$transaction([
    prisma.weeklyReview.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      create: { userId: user.id, weekStart, leadIdentityId: lead?.id ?? null, statement: statement ?? null, adjustment },
      update: { leadIdentityId: lead?.id ?? null, statement: statement ?? null, adjustment },
    }),
    ...(changed
      ? [prisma.habitRecurrence.update({ where: { taskId: habit.id }, data: { minimalTask: newMinimum } })]
      : []),
  ]);

  revalidatePath("/review");
  revalidatePath("/day");
  revalidatePath("/identities");
  if (changed) revalidatePath("/habits");
  return { ok: true };
}
