"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseLocalDate, todayLocal } from "@/lib/dates";
import { setSelectedTask } from "@/lib/day-log";
import { parseQuickAdd } from "@/lib/quick-parse";
import {
  type ActionState,
  formValues,
  selectOneThingSchema,
} from "@/lib/validation";

function revalidateFocus() {
  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/inbox");
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
