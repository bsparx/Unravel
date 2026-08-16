"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseLocalDate, todayLocal } from "@/lib/dates";
import { setSelectedTask } from "@/lib/day-log";
import { parseQuickAdd } from "@/lib/quick-parse";
import { stepCreateRows } from "@/lib/step-sync";
import {
  type ActionState,
  createOneThingSchema,
  fieldErrorsFrom,
  formValues,
  selectOneThingSchema,
} from "@/lib/validation";

function revalidateFocus() {
  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/behavior");
  revalidatePath("/close");
}

/**
 * Choose the one thing for a day.
 *
 * Accepts three routes in: an existing task, a captured thought (which becomes
 * a task), or freshly typed text (which also becomes a task). It always ends
 * with a real `Task`, because that's what makes the card clickable straight
 * into a timer — a selection that were just a string would be a dead end.
 *
 * Used by both the morning pass on `/` and step one of `/close`, which is why
 * it takes the date rather than assuming today.
 */
export async function selectOneThing(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = selectOneThingSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return { status: "error", message: "Pick something, or type it." };
  }

  const { date: dateISO, taskId, captureId, title } = parsed.data;
  const date = parseLocalDate(dateISO);
  if (!date) return { status: "error", message: "That date didn't parse." };

  let resolvedTaskId: string | null = null;

  if (taskId) {
    const owned = await prisma.task.findFirst({
      where: { id: taskId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { status: "error", message: "That task is gone." };
    resolvedTaskId = owned.id;
  } else if (captureId) {
    resolvedTaskId = await promoteToTask(user.id, captureId);
    if (!resolvedTaskId) {
      return { status: "error", message: "That note is gone." };
    }
  } else if (title) {
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        type: "TODO",
        title: title.slice(0, 200),
        dueDate: date,
        sortOrder: Date.now(),
      },
    });
    resolvedTaskId = task.id;
  }

  if (!resolvedTaskId) {
    return { status: "error", message: "Pick something, or type it." };
  }

  await setSelectedTask(user.id, date, resolvedTaskId);
  revalidateFocus();

  return { status: "success" };
}

/**
 * The one thing, set up in full: steps, an estimate, how the timer should open.
 *
 * A separate route in from `selectOneThing` because it's a different act.
 * That one picks something that already exists; this one is the task form, and
 * it creates and selects in a single submit so you never land on a "now go find
 * it in the list" screen.
 *
 * No deadline field: the day you're planning is the deadline, and it's set
 * here rather than asked for.
 */
export async function createOneThing(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createOneThingSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const date = parseLocalDate(input.date);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const projectId = input.projectId
    ? ((
        await prisma.project.findFirst({
          where: { id: input.projectId, userId: user.id },
          select: { id: true },
        })
      )?.id ?? null)
    : null;

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      type: "TODO",
      title: input.title,
      notes: input.notes || null,
      priority: input.priority,
      projectId,
      dueDate: date,
      estimatedSeconds: input.estimateMinutes
        ? input.estimateMinutes * 60
        : null,
      defaultMode: input.defaultMode,
      plannedIntervals: input.plannedIntervals ?? null,
      sortOrder: Date.now(),
      steps: { create: stepCreateRows(user.id, input.steps) },
    },
  });

  await setSelectedTask(user.id, date, task.id);
  revalidateFocus();
  // The task list and calendar both gained a row.
  revalidatePath("/tasks");
  revalidatePath("/calendar");

  return { status: "success", message: "That's the frog." };
}

/** Change your mind. The task itself is untouched. */
export async function clearOneThing(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = String(formData.get("date") ?? "");
  const date = parseLocalDate(raw) ?? todayLocal(user.timezone);

  await setSelectedTask(user.id, date, null);
  revalidateFocus();
}

async function promoteToTask(
  userId: string,
  captureId: string,
): Promise<string | null> {
  const capture = await prisma.capture.findFirst({
    where: { id: captureId, userId },
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
      sortOrder: Date.now(),
    },
  });

  await prisma.capture.update({
    where: { id: capture.id },
    data: { status: "PROMOTED", promotedTaskId: task.id },
  });

  return task.id;
}
