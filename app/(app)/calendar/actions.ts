"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  clampSpan,
  findFreeSlot,
  MIN_BLOCK_MINUTES,
  snap,
  spanOfLength,
} from "@/lib/block-math";
import { prisma } from "@/lib/db";
import { parseLocalDate } from "@/lib/dates";
import {
  type ActionState,
  createBlockSchema,
  deleteBlockSchema,
  fieldErrorsFrom,
  formValues,
  moveBlockSchema,
  scheduleTaskSchema,
  updateBlockSchema,
} from "@/lib/validation";

/** The default length for a task with no estimate: one pomodoro. */
const DEFAULT_BLOCK_MINUTES = 25;
/** Where "find me a slot" starts looking on an otherwise empty day. */
const DAY_START_MINUTE = 9 * 60;

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/day");
  revalidatePath("/");
}

// ---------------------------------------------------------------- create/edit

export async function createBlock(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createBlockSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "That block didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const date = parseLocalDate(input.date);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const span = clampSpan(input.startMinute, input.endMinute);

  await prisma.timeBlock.create({
    data: {
      userId: user.id,
      taskId: await resolveTaskId(user.id, input.taskId),
      title: input.title,
      notes: input.notes || null,
      date,
      ...span,
      kind: input.kind,
    },
  });

  revalidateCalendar();
  return { status: "success", message: "Blocked out." };
}

export async function updateBlock(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateBlockSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "That block didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const date = parseLocalDate(input.date);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const { count } = await prisma.timeBlock.updateMany({
    where: { id: input.id, userId: user.id },
    data: {
      taskId: await resolveTaskId(user.id, input.taskId),
      title: input.title,
      notes: input.notes || null,
      date,
      ...clampSpan(input.startMinute, input.endMinute),
      kind: input.kind,
    },
  });

  if (count === 0) {
    return { status: "error", message: "That block is already gone." };
  }

  revalidateCalendar();
  return { status: "success", message: "Saved." };
}

/**
 * Drag-to-move and drag-to-resize.
 *
 * Separate from `updateBlock` because it has a different contract: it takes no
 * text, coerces rather than validates (you can't type a bad value with a
 * mouse, only an awkward one), and returns nothing — the optimistic UI has
 * already moved the block, and re-rendering it from a server response would
 * make it visibly jump back and forth.
 */
export async function moveBlock(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = moveBlockSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  await prisma.timeBlock.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      date,
      ...clampSpan(snap(parsed.data.startMinute), snap(parsed.data.endMinute)),
    },
  });

  revalidateCalendar();
}

// ---------------------------------------------------------------- scheduling

/**
 * "Put this on the calendar" in one click.
 *
 * The length comes from the task's own estimate, so the number you committed
 * to when you wrote the task is the number that shows up in your day — that
 * link is the point of asking for an estimate at all.
 *
 * With no `startMinute`, it finds the first gap big enough. If the day is
 * genuinely full it says so instead of stacking another block on top: being
 * told "there's no room" is the useful outcome, and quietly double-booking is
 * how a calendar stops meaning anything.
 */
export async function scheduleTask(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = scheduleTaskSchema.safeParse(formValues(formData));

  if (!parsed.success) {
    return { status: "error", message: "Couldn't schedule that." };
  }

  const input = parsed.data;
  const date = parseLocalDate(input.date);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const task = await prisma.task.findFirst({
    where: { id: input.taskId, userId: user.id },
    select: { id: true, title: true, estimatedSeconds: true },
  });

  if (!task) return { status: "error", message: "That task no longer exists." };

  const minutes = Math.max(
    MIN_BLOCK_MINUTES,
    input.minutes ??
      (task.estimatedSeconds
        ? Math.round(task.estimatedSeconds / 60)
        : DEFAULT_BLOCK_MINUTES),
  );

  const existing = await prisma.timeBlock.findMany({
    where: { userId: user.id, date },
    select: { startMinute: true, endMinute: true },
    orderBy: { startMinute: "asc" },
  });

  const span =
    input.startMinute !== undefined
      ? spanOfLength(snap(input.startMinute), minutes)
      : findFreeSlot(existing, minutes, DAY_START_MINUTE);

  if (!span) {
    return {
      status: "error",
      message: `No free ${minutes}-minute gap left that day. Move something, or make this one smaller.`,
    };
  }

  await prisma.timeBlock.create({
    data: {
      userId: user.id,
      taskId: task.id,
      title: task.title,
      date,
      ...clampSpan(span.startMinute, span.endMinute),
      kind: "WORK",
    },
  });

  revalidateCalendar();
  return { status: "success", message: "On the calendar." };
}

// ---------------------------------------------------------------- lifecycle

export async function deleteBlock(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteBlockSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.timeBlock.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });

  revalidateCalendar();
}

/**
 * Tick a block off.
 *
 * Deliberately does NOT complete the underlying task: finishing the 9am block
 * on "write the report" is not finishing the report, and conflating them would
 * either lie about the task or make you afraid to tick the block.
 */
export async function toggleBlockDone(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return;

  await prisma.timeBlock.updateMany({
    where: { id, userId: user.id },
    data: { completedAt: done ? new Date() : null },
  });

  revalidateCalendar();
}

async function resolveTaskId(
  userId: string,
  taskId: string | undefined,
): Promise<string | null> {
  if (!taskId) return null;
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });
  return task?.id ?? null;
}
