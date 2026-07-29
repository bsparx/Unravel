"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVERY_DAY, parseLocalDate, todayLocal } from "@/lib/dates";
import {
  getHabitQuota,
  setHabitProgress,
  toggleHabitDone,
} from "@/lib/habit-progress";
import { stepCreateRows, syncSteps } from "@/lib/step-sync";
import {
  type ActionState,
  createHabitSchema,
  fieldErrorsFrom,
  formValues,
  habitProgressSchema,
  toggleTaskSchema,
  updateHabitSchema,
} from "@/lib/validation";

function revalidateHabitViews() {
  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/habits");
  revalidatePath("/calendar");
  revalidatePath("/habits/stats");
  revalidatePath("/stats");
}

const isEveryDay = (days: number[]) =>
  EVERY_DAY.every((day) => days.includes(day));

export async function createHabit(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createHabitSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const today = todayLocal(user.timezone);

  await prisma.task.create({
    data: {
      userId: user.id,
      type: "HABIT",
      title: input.title,
      notes: input.notes || null,
      priority: input.priority,
      projectId: await resolveProjectId(user.id, input.projectId),
      estimatedSeconds: input.estimateMinutes
        ? input.estimateMinutes * 60
        : null,
      defaultMode: input.defaultMode,
      plannedIntervals: input.plannedIntervals ?? null,
      sortOrder: Date.now(),
      steps: { create: stepCreateRows(user.id, input.steps) },
      recurrence: {
        create: {
          kind: isEveryDay(input.daysOfWeek) ? "DAILY" : "SPECIFIC_DAYS",
          daysOfWeek: input.daysOfWeek,
          startDate: input.startDate
            ? (parseLocalDate(input.startDate) ?? today)
            : today,
          endDate: input.endDate ? parseLocalDate(input.endDate) : null,
          unit: input.unit,
          minimumQuota: input.minimumQuota,
          optimalQuota: input.optimalQuota ?? null,
        },
      },
    },
  });

  revalidateHabitViews();
  return { status: "success", message: "Habit added." };
}

export async function updateHabit(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateHabitSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;

  const owned = await prisma.task.findFirst({
    where: { id: input.id, userId: user.id, type: "HABIT" },
    select: { id: true, recurrence: { select: { startDate: true } } },
  });

  if (!owned) {
    return { status: "error", message: "That habit no longer exists." };
  }

  const today = todayLocal(user.timezone);
  // Keep the original startDate unless the form changed it — it anchors the
  // streak, so silently moving it would rewrite history.
  const startDate = input.startDate
    ? (parseLocalDate(input.startDate) ?? owned.recurrence?.startDate ?? today)
    : (owned.recurrence?.startDate ?? today);

  await prisma.task.update({
    where: { id: owned.id },
    data: {
      title: input.title,
      notes: input.notes || null,
      priority: input.priority,
      projectId: await resolveProjectId(user.id, input.projectId),
      estimatedSeconds: input.estimateMinutes
        ? input.estimateMinutes * 60
        : null,
      defaultMode: input.defaultMode,
      plannedIntervals: input.plannedIntervals ?? null,
      recurrence: {
        upsert: {
          create: {
            kind: isEveryDay(input.daysOfWeek) ? "DAILY" : "SPECIFIC_DAYS",
            daysOfWeek: input.daysOfWeek,
            startDate,
            endDate: input.endDate ? parseLocalDate(input.endDate) : null,
            unit: input.unit,
            minimumQuota: input.minimumQuota,
            optimalQuota: input.optimalQuota ?? null,
          },
          update: {
            kind: isEveryDay(input.daysOfWeek) ? "DAILY" : "SPECIFIC_DAYS",
            daysOfWeek: input.daysOfWeek,
            startDate,
            endDate: input.endDate ? parseLocalDate(input.endDate) : null,
            unit: input.unit,
            minimumQuota: input.minimumQuota,
            optimalQuota: input.optimalQuota ?? null,
          },
        },
      },
    },
  });

  await syncSteps(user.id, owned.id, input.steps);

  revalidateHabitViews();
  return { status: "success", message: "Saved." };
}

/**
 * Habits are archived, never completed — a habit you've stopped doing still has
 * a history worth keeping on /stats.
 */
export async function archiveHabit(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const restore = formData.get("restore") === "true";

  await prisma.task.updateMany({
    where: { id: taskId, userId: user.id, type: "HABIT" },
    data: { archivedAt: restore ? null : new Date() },
  });

  revalidateHabitViews();
}

export async function deleteHabit(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  await prisma.task.deleteMany({
    where: { id: taskId, userId: user.id, type: "HABIT" },
  });

  revalidateHabitViews();
}

async function resolveProjectId(
  userId: string,
  projectId: string | undefined,
): Promise<string | null> {
  if (!projectId) return null;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  return project?.id ?? null;
}

// ---------------------------------------------------------------- quotas

/**
 * Move a habit's progress for a day: the +1 button, the stepper, or a typed
 * number.
 *
 * Note that changing the quota later does **not** rewrite past days. Their
 * `tier` was recorded against the quota in force at the time, which is the
 * honest record — raising your minimum from one page to ten shouldn't
 * retroactively delete a streak you actually earned.
 */
export async function logHabitProgress(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = habitProgressSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  // Scoped by userId inside, so an id off the wire finds nothing rather than
  // someone else's habit.
  const quota = await getHabitQuota(user.id, parsed.data.taskId);
  if (!quota) return;

  await setHabitProgress(
    user.id,
    quota,
    date,
    parsed.data.set !== undefined
      ? { set: parsed.data.set }
      : { increment: parsed.data.increment! },
  );

  revalidateHabitViews();
}

/**
 * Tick a habit off for today from a list.
 *
 * Routes through the quota so `progress`, `tier` and `status` can never
 * disagree — see `lib/habit-progress.ts`. Ticking books exactly the minimum,
 * never the optimal: a checkbox is a claim that you did it, not that you had a
 * good day.
 */
export async function toggleHabitForDate(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = toggleTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    done: formData.get("done") === "true",
  });
  if (!parsed.success) return;

  const date = parseLocalDate(String(formData.get("date") ?? ""));
  if (!date) return;

  const quota = await getHabitQuota(user.id, parsed.data.taskId);
  if (!quota) return;

  await toggleHabitDone(user.id, quota, date, parsed.data.done);
  revalidateHabitViews();
}
