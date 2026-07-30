"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  clampSpan,
  findFreeSlot,
  MIN_BLOCK_MINUTES,
  snap,
  type Span,
  spanOfLength,
} from "@/lib/block-math";
import { prisma } from "@/lib/db";
import { parseLocalDate } from "@/lib/dates";
import { anchorTitleOf, cueLengthMinutes, cueSpanFor } from "@/lib/habit-cue";
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

// ---------------------------------------------------------------- cues

/**
 * A habit's cue, resolved into the block it wants to become.
 *
 * `taskId` is the anchor habit when the anchor is one, and null for a plain
 * label — which is the whole point of the two anchor kinds meeting here. A habit
 * anchor's block is a real block for that habit: timer-able, counted, and gone
 * from the "not on the day yet" panel. "Drinking tea" gets a block with no task
 * behind it, because it is a cue and was never a thing to track.
 */
type PlannedCue = { taskId: string | null; title: string; minutes: number };

async function plannedCueFor(
  userId: string,
  taskId: string | null,
  includeCue: boolean,
): Promise<PlannedCue | null> {
  if (!includeCue || !taskId) return null;

  const cue = await prisma.habitCue.findFirst({
    // Scoped through the owning task, so an id off the wire can't read someone
    // else's stack.
    where: { taskId, task: { userId } },
    select: {
      anchorTaskId: true,
      anchorLabel: true,
      anchorMinutes: true,
      anchorTask: { select: { title: true, estimatedSeconds: true } },
    },
  });

  if (!cue) return null;

  const title = anchorTitleOf(cue, cue.anchorTask?.title);
  if (!title) return null;

  return {
    taskId: cue.anchorTaskId,
    title,
    minutes: cueLengthMinutes(cue, cue.anchorTask?.estimatedSeconds),
  };
}

type BlockCreate = {
  userId: string;
  taskId: string | null;
  title: string;
  notes?: string | null;
  date: Date;
  startMinute: number;
  endMinute: number;
  kind: "WORK" | "RECOVERY" | "BUFFER";
};

/**
 * Write a block and, if it has one, the cue block immediately before it.
 *
 * One transaction: a habit whose cue silently failed to land is worse than
 * neither, because the recipe is the thing that makes the habit happen and a
 * half-written recipe looks complete.
 */
async function createBlockWithCue(
  data: BlockCreate,
  cue: PlannedCue | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const block = await tx.timeBlock.create({ data });
    if (!cue) return;

    const span = cueSpanFor(block, cue.minutes);
    // Null only when the habit starts at 00:00 — there is no "before" to put it
    // in, and moving the habit to make room would be answering a question
    // nobody asked.
    if (!span) return;

    await tx.timeBlock.create({
      data: {
        userId: data.userId,
        taskId: cue.taskId,
        title: cue.title,
        date: data.date,
        ...span,
        kind: "WORK",
        cueForId: block.id,
      },
    });
  });
}

/**
 * Keep an existing cue block glued to the front of the block it cues, after that
 * block has moved or changed length. Its own length is preserved.
 */
async function reflowCue(
  userId: string,
  blockId: string,
  date: Date,
  span: Span,
): Promise<void> {
  const cue = await prisma.timeBlock.findFirst({
    where: { cueForId: blockId, userId },
    select: { id: true, startMinute: true, endMinute: true },
  });

  if (!cue) return;

  const next = cueSpanFor(span, cue.endMinute - cue.startMinute);
  if (!next) return;

  await prisma.timeBlock.update({
    where: { id: cue.id },
    data: { date, ...next },
  });
}

/** Append the cue's name to a success message, when there is one. */
const withCueNote = (message: string, cue: PlannedCue | null) =>
  cue ? `${message} — with ${cue.title} before it.` : message;

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
  const taskId = await resolveTaskId(user.id, input.taskId);
  const cue = await plannedCueFor(user.id, taskId, input.includeCue);

  await createBlockWithCue(
    {
      userId: user.id,
      taskId,
      title: input.title,
      notes: input.notes || null,
      date,
      ...span,
      kind: input.kind,
    },
    cue,
  );

  revalidateCalendar();
  return { status: "success", message: withCueNote("Blocked out.", cue) };
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

  const span = clampSpan(input.startMinute, input.endMinute);
  const taskId = await resolveTaskId(user.id, input.taskId);

  const { count } = await prisma.timeBlock.updateMany({
    where: { id: input.id, userId: user.id },
    data: {
      taskId,
      title: input.title,
      notes: input.notes || null,
      date,
      ...span,
      kind: input.kind,
    },
  });

  if (count === 0) {
    return { status: "error", message: "That block is already gone." };
  }

  // An existing cue follows the block it cues. A missing one is only added when
  // asked for — a cue dropped for the day should stay dropped, and re-editing
  // the block is not a request to bring it back.
  const existing = await prisma.timeBlock.findFirst({
    where: { cueForId: input.id, userId: user.id },
    select: { id: true },
  });

  let cue: PlannedCue | null = null;

  if (existing) {
    await reflowCue(user.id, input.id, date, span);
  } else {
    cue = await plannedCueFor(user.id, taskId, input.includeCue);
    if (cue) {
      const cueSpan = cueSpanFor(span, cue.minutes);
      if (cueSpan) {
        await prisma.timeBlock.create({
          data: {
            userId: user.id,
            taskId: cue.taskId,
            title: cue.title,
            date,
            ...cueSpan,
            kind: "WORK",
            cueForId: input.id,
          },
        });
      }
    }
  }

  revalidateCalendar();
  return { status: "success", message: withCueNote("Saved.", cue) };
}

/**
 * Drag-to-move and drag-to-resize.
 *
 * Separate from `updateBlock` because it has a different contract: it takes no
 * text, coerces rather than validates (you can't type a bad value with a
 * mouse, only an awkward one), and returns nothing — the optimistic UI has
 * already moved the block, and re-rendering it from a server response would
 * make it visibly jump back and forth.
 *
 * A cue block travels with the block it cues. Adjacency is the mechanism, so a
 * habit dragged to 10:00 whose cue stayed behind at 07:55 would have quietly
 * stopped being a stack.
 */
export async function moveBlock(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = moveBlockSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const date = parseLocalDate(parsed.data.date);
  if (!date) return;

  const span = clampSpan(
    snap(parsed.data.startMinute),
    snap(parsed.data.endMinute),
  );

  const { count } = await prisma.timeBlock.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { date, ...span },
  });

  // Ownership is established by that update, so the reflow can match on the
  // block id alone. Skipped entirely when nothing was updated.
  if (count > 0) await reflowCue(user.id, parsed.data.id, date, span);

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
 *
 * A habit with a cue needs room for both, contiguously — so the gap search asks
 * for the pair's total length and then splits what it gets. Fitting the habit
 * alone and hoping the cue lands somewhere would produce exactly the "there was
 * no room but I put it there anyway" that the refusal above exists to prevent.
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

  const cue = await plannedCueFor(user.id, task.id, input.includeCue);
  const cueMinutes = cue?.minutes ?? 0;

  const existing = await prisma.timeBlock.findMany({
    where: { userId: user.id, date },
    select: { startMinute: true, endMinute: true },
    orderBy: { startMinute: "asc" },
  });

  let span: Span | null;

  if (input.startMinute !== undefined) {
    // Dropped somewhere specific: put it exactly there. The cue goes in front of
    // it and may overlap whatever is already there — the calendar's job is to
    // show you that you double-booked, not to refuse the booking.
    span = spanOfLength(snap(input.startMinute), minutes);
  } else {
    const slot = findFreeSlot(
      existing,
      cueMinutes + minutes,
      DAY_START_MINUTE,
    );
    // Take the back of the gap for the habit; `createBlockWithCue` fills the
    // front with the cue.
    span = slot
      ? { startMinute: slot.startMinute + cueMinutes, endMinute: slot.endMinute }
      : null;
  }

  if (!span) {
    const wanted = cueMinutes + minutes;
    return {
      status: "error",
      message: cue
        ? `No free ${wanted}-minute gap left that day — ${task.title} needs room for ${cue.title} first. Move something, or make this one smaller.`
        : `No free ${wanted}-minute gap left that day. Move something, or make this one smaller.`,
    };
  }

  await createBlockWithCue(
    {
      userId: user.id,
      taskId: task.id,
      title: task.title,
      date,
      ...clampSpan(span.startMinute, span.endMinute),
      kind: "WORK",
    },
    cue,
  );

  revalidateCalendar();
  return {
    status: "success",
    message: withCueNote("On the calendar.", cue),
  };
}

// ---------------------------------------------------------------- lifecycle

/**
 * Also the "not today" path for a cue: passing the cue block's own id removes
 * just the cue and leaves the habit where it is, without touching the habit's
 * definition. Passing the habit's block takes its cue with it, via the
 * `cueForId` cascade — which is the right direction, and only that direction.
 */
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
