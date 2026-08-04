"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseLocalDate, todayLocal } from "@/lib/dates";
import { getHabitQuota, toggleHabitDone, creditLoggedTime } from "@/lib/habit-progress";
import {
  addLoggedSeconds,
  ensureOccurrence,
  setOccurrenceStatus,
} from "@/lib/occurrences";
import { parseQuickAdd } from "@/lib/quick-parse";
import { stepCreateRows, syncSteps } from "@/lib/step-sync";
import {
  type ActionState,
  createTodoSchema,
  fieldErrorsFrom,
  formValues,
  logAndCompleteSchema,
  projectSchema,
  quickAddSchema,
  toggleOccurrenceSchema,
  toggleStepSchema,
  toggleTaskSchema,
  updateTaskColorSchema,
  updateTodoSchema,
} from "@/lib/validation";

function revalidateTaskViews() {
  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/habits/stats");
  revalidatePath("/calendar");
  revalidatePath("/stats");
}

// ---------------------------------------------------------------- create/edit

export async function createTodo(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createTodoSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;

  await prisma.task.create({
    data: {
      userId: user.id,
      type: "TODO",
      title: input.title,
      notes: input.notes || null,
      priority: input.priority,
      projectId: await resolveProjectId(user.id, input.projectId),
      dueDate: input.dueDate ? parseLocalDate(input.dueDate) : null,
      estimatedSeconds: input.estimateMinutes
        ? input.estimateMinutes * 60
        : null,
      defaultMode: input.defaultMode,
      plannedIntervals: input.plannedIntervals ?? null,
      sortOrder: Date.now(),
      color: input.color,
      steps: { create: stepCreateRows(user.id, input.steps) },
    },
  });

  revalidateTaskViews();
  return { status: "success", message: "Task added." };
}

export async function updateTodo(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateTodoSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;

  // Scoped by userId, so a guessed id updates nothing rather than someone
  // else's task.
  const { count } = await prisma.task.updateMany({
    where: { id: input.id, userId: user.id },
    data: {
      title: input.title,
      notes: input.notes || null,
      priority: input.priority,
      projectId: await resolveProjectId(user.id, input.projectId),
      dueDate: input.dueDate ? parseLocalDate(input.dueDate) : null,
      estimatedSeconds: input.estimateMinutes
        ? input.estimateMinutes * 60
        : null,
      defaultMode: input.defaultMode,
      plannedIntervals: input.plannedIntervals ?? null,
      color: input.color,
    },
  });

  if (count === 0) {
    return { status: "error", message: "That task no longer exists." };
  }

  await syncSteps(user.id, input.id, input.steps);

  revalidateTaskViews();
  revalidatePath(`/tasks/${input.id}`);
  return { status: "success", message: "Saved." };
}

/**
 * Re-colour a task from the block dialog, where its colour is worn. One
 * field, scoped like every other write; the task's own row is the single
 * source of truth, so every block it becomes re-tints with it.
 */
export async function updateTaskColor(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = updateTaskColorSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.task.updateMany({
    where: { id: parsed.data.taskId, userId: user.id },
    data: { color: parsed.data.color },
  });
  revalidateTaskViews();
}

/**
 * Tick a single step. Fire-and-forget from the row — no ActionState, because
 * the UI is already optimistic and a toast for "you ticked a checkbox" is
 * noise.
 */
export async function toggleStep(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = toggleStepSchema.safeParse({
    stepId: formData.get("stepId"),
    done: formData.get("done") === "true",
  });

  if (!parsed.success) return;

  await prisma.taskStep.updateMany({
    where: { id: parsed.data.stepId, userId: user.id },
    data: { completedAt: parsed.data.done ? new Date() : null },
  });

  revalidateTaskViews();
}

/**
 * Single-line capture. The whole point is that adding something costs one
 * keystroke and no decisions, so the extras are inline shorthand:
 *   "Email the landlord 20m #Admin p1"
 */
export async function quickAdd(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = quickAddSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return { status: "error", message: "Type something to add it." };
  }

  const { title, minutes, projectName, priority } = parseQuickAdd(
    parsed.data.input,
  );

  if (!title) {
    return { status: "error", message: "That was only shorthand — add a name." };
  }

  let projectId: string | null = null;
  if (projectName) {
    const project = await prisma.project.upsert({
      where: { userId_name: { userId: user.id, name: projectName } },
      create: { userId: user.id, name: projectName, sortOrder: Date.now() },
      update: {},
    });
    projectId = project.id;
  }

  await prisma.task.create({
    data: {
      userId: user.id,
      type: "TODO",
      title,
      priority,
      projectId,
      dueDate: todayLocal(user.timezone),
      estimatedSeconds: minutes ? minutes * 60 : null,
      sortOrder: Date.now(),
    },
  });

  revalidateTaskViews();
  return { status: "success" };
}

// ---------------------------------------------------------------- completion

/**
 * Tick done on a day where nothing was logged, and book the time back.
 *
 * The one question a checkbox can't answer: "how long did it actually take".
 * Ticking without the timer running would leave a DONE day with zero minutes
 * behind it — a hole in every average and habit tier downstream. This is the
 * other half of that moment.
 *
 * For a MINUTES habit the logged minutes are credited through the quota before
 * the habit is marked done, so the tier, streak and charts all read the real
 * figure rather than just the minimum. For a COUNT habit the quota is untouched
 * (time isn't pages) and ticking books the minimum as it always has — the time
 * still lands in the day's `loggedSeconds` for the stats.
 */
export async function logAndComplete(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = logAndCompleteSchema.safeParse(formValues(formData));

  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, userId: user.id },
    select: { id: true, type: true },
  });
  if (!task) return;

  const occurrence = await ensureOccurrence(user.id, task.id, date);
  await addLoggedSeconds(occurrence.id, parsed.data.minutes * 60);

  const updated = await prisma.taskOccurrence.findUnique({
    where: { id: occurrence.id },
    select: { loggedSeconds: true },
  });
  const loggedSeconds = updated?.loggedSeconds ?? 0;

  if (task.type === "HABIT") {
    const quota = await getHabitQuota(user.id, task.id);
    if (!quota) return;

    await creditLoggedTime(user.id, task.id, date, loggedSeconds);
    await toggleHabitDone(user.id, quota, date, true);
  } else {
    await prisma.task.updateMany({
      where: { id: task.id, userId: user.id, type: "TODO" },
      data: { completedAt: new Date() },
    });
    await setOccurrenceStatus(user.id, task.id, date, "DONE");
  }

  revalidateTaskViews();
  // The timer's "today's total" is assembled from the committed occurrence
  // figure, so a manual log lands there too.
  revalidatePath("/timer");
}

export async function toggleTodo(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = toggleTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    done: formData.get("done") === "true",
  });

  if (!parsed.success) return;

  const today = todayLocal(user.timezone);

  const { count } = await prisma.task.updateMany({
    where: { id: parsed.data.taskId, userId: user.id, type: "TODO" },
    data: { completedAt: parsed.data.done ? new Date() : null },
  });

  if (count === 0) return;

  // Mirror it onto the day's occurrence so /stats counts completions the same
  // way for todos and habits.
  await setOccurrenceStatus(
    user.id,
    parsed.data.taskId,
    today,
    parsed.data.done ? "DONE" : "PENDING",
  );

  revalidateTaskViews();
}

export async function toggleOccurrence(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = toggleOccurrenceSchema.safeParse({
    taskId: formData.get("taskId"),
    date: formData.get("date"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  const owned = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, userId: user.id },
    select: { id: true, type: true },
  });
  if (!owned) return;

  // A habit's DONE has to go through its quota, or the day counts for the
  // streak while every chart reads tier NONE. SKIPPED is untouched by quotas —
  // it deliberately means "not today", which is neither done nor missed.
  if (owned.type === "HABIT" && parsed.data.status !== "SKIPPED") {
    const quota = await getHabitQuota(user.id, owned.id);
    if (quota) {
      await toggleHabitDone(user.id, quota, date, parsed.data.status === "DONE");
      revalidateTaskViews();
      return;
    }
  }

  await setOccurrenceStatus(
    user.id,
    parsed.data.taskId,
    date,
    parsed.data.status,
  );

  revalidateTaskViews();
}

// ---------------------------------------------------------------- lifecycle

export async function deleteTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  await prisma.task.deleteMany({ where: { id: taskId, userId: user.id } });
  revalidateTaskViews();
}

export async function archiveTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  await prisma.task.updateMany({
    where: { id: taskId, userId: user.id },
    data: { archivedAt: new Date() },
  });
  revalidateTaskViews();
}

// ---------------------------------------------------------------- projects

export async function createProject(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = projectSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return { status: "error", message: "Give the list a name." };
  }

  const existing = await prisma.project.findUnique({
    where: { userId_name: { userId: user.id, name: parsed.data.name } },
  });

  if (existing) {
    return { status: "error", message: "You already have a list by that name." };
  }

  await prisma.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      sortOrder: Date.now(),
    },
  });

  revalidateTaskViews();
  return { status: "success", message: "List created." };
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
