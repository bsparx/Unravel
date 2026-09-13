"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  clampSpan,
  findFreeSlot,
  PLAN_CUE_MINUTES,
  PLAN_DEFAULT_MINUTES,
  snap,
  type Span,
  spanOfLength,
} from "@/lib/block-math";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseLocalDate } from "@/lib/dates";
import { anchorTitleOf, cueSpanFor } from "@/lib/habit-cue";
import {
  type ActionState,
  addTaskToBlockSchema,
  createBlockSchema,
  deleteBlockSchema,
  fieldErrorsFrom,
  formValues,
  MAX_BLOCK_TASKS,
  moveBlockSchema,
  scheduleTaskSchema,
  toggleBlockTaskSchema,
  updateBlockSchema,
} from "@/lib/validation";

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
      anchorTask: { select: { title: true } },
    },
  });

  if (!cue) return null;

  const title = anchorTitleOf(cue, cue.anchorTask?.title);
  if (!title) return null;

  return {
    taskId: cue.anchorTaskId,
    title,
    minutes: PLAN_CUE_MINUTES,
  };
}

/**
 * The cue for a whole task list.
 *
 * A block can hold several tasks, and more than one of them may be a stacked
 * habit. Only one precursor can be prepended — the schema allows a block one
 * `cueForId` — so the first one wins, in the order the tasks were picked. Two
 * cues on one block would mean two blocks "immediately before" the same thing,
 * and adjacency stops meaning anything at that point.
 */
async function plannedCueForAny(
  userId: string,
  taskIds: string[],
  includeCue: boolean,
): Promise<PlannedCue | null> {
  if (!includeCue) return null;

  for (const taskId of taskIds) {
    const cue = await plannedCueFor(userId, taskId, includeCue);
    if (cue) return cue;
  }

  return null;
}

type BlockCreate = {
  userId: string;
  /** The tasks the stretch is for. Empty for "lunch", "gym" and other named claims. */
  taskIds: string[];
  title: string;
  notes?: string | null;
  date: Date;
  startMinute: number;
  endMinute: number;
  kind: "WORK" | "RECOVERY" | "BUFFER" | "DAYDREAM";
};

/**
 * Write a block, its task list, and — if it has one — the cue block immediately
 * before it.
 *
 * One transaction: a habit whose cue silently failed to land is worse than
 * neither, because the recipe is the thing that makes the habit happen and a
 * half-written recipe looks complete.
 */
async function createBlockWithCue(
  data: BlockCreate,
  cue: PlannedCue | null,
): Promise<void> {
  const { taskIds, ...block } = data;

  await prisma.$transaction(async (tx) => {
    const created = await tx.timeBlock.create({ data: block });
    await linkTasks(tx, created.id, taskIds);
    if (!cue) return;

    const span = cueSpanFor(created, cue.minutes);
    // Null only when the habit starts at 00:00 — there is no "before" to put it
    // in, and moving the habit to make room would be answering a question
    // nobody asked.
    if (!span) return;

    await createCueBlock(tx, cue, {
      userId: data.userId,
      date: data.date,
      span,
      cueForId: created.id,
    });
  });
}

/**
 * The precursor half of a habit stack: a block glued to the front of the one it
 * cues, carrying the anchor habit's task when there is one.
 *
 * A cue with no task behind it is the "drinking tea" case — a label and nothing
 * more, deliberately untracked, because it was never a goal.
 */
async function createCueBlock(
  tx: Prisma.TransactionClient,
  cue: PlannedCue,
  data: { userId: string; date: Date; span: Span; cueForId: string },
): Promise<void> {
  const block = await tx.timeBlock.create({
    data: {
      userId: data.userId,
      title: cue.title,
      date: data.date,
      ...data.span,
      kind: "WORK",
      cueForId: data.cueForId,
    },
  });

  if (cue.taskId) await linkTasks(tx, block.id, [cue.taskId]);
}

/**
 * The only writer of `TimeBlockTask` rows on create.
 *
 * `position` is the index it went in at — display order, not a priority. The
 * product promises no order between a block's tasks; this exists so a re-render
 * doesn't reshuffle the lines under the person's cursor.
 */
async function linkTasks(
  tx: Prisma.TransactionClient,
  blockId: string,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) return;

  await tx.timeBlockTask.createMany({
    data: taskIds.map((taskId, position) => ({ blockId, taskId, position })),
    skipDuplicates: true,
  });
}

/**
 * Make the block's task list exactly `taskIds`, keeping the ticks.
 *
 * A diff rather than delete-and-recreate: a tick inside the block is a real
 * thing someone did, and saving the block after adding a fourth task must not
 * silently un-tick the three already done. A task that leaves the block loses
 * its tick — that tick belonged to this stretch of time, not to the task.
 */
async function syncBlockTasks(
  userId: string,
  blockId: string,
  taskIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // `notIn: []` matches everything in Prisma, which is exactly right here:
    // an empty list means the block no longer holds anything.
    await tx.timeBlockTask.deleteMany({
      where: { blockId, taskId: { notIn: taskIds } },
    });

    for (const [position, taskId] of taskIds.entries()) {
      await tx.timeBlockTask.upsert({
        where: { blockId_taskId: { blockId, taskId } },
        update: { position },
        create: { blockId, taskId, position },
      });
    }
  });

  await reconcileBlockCompletion(userId, blockId);
}

/**
 * Keep the block's own tick agreeing with the tasks inside it.
 *
 * One rule, three states: a block with tasks is done exactly when all of them
 * are ticked. Ticking the last one closes the block; un-ticking one reopens it.
 * A block with no tasks is left alone — its tick is the only thing that can
 * speak for it, and "lunch" has no lines to tally.
 */
async function reconcileBlockCompletion(
  userId: string,
  blockId: string,
): Promise<void> {
  const block = await prisma.timeBlock.findFirst({
    where: { id: blockId, userId },
    select: { completedAt: true, tasks: { select: { doneAt: true } } },
  });

  if (!block || block.tasks.length === 0) return;

  const allDone = block.tasks.every((link) => link.doneAt !== null);
  if (allDone === (block.completedAt !== null)) return;

  await prisma.timeBlock.update({
    where: { id: blockId },
    data: { completedAt: allDone ? new Date() : null },
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
  const taskIds = await resolveTaskIds(user.id, input.taskIds);
  const cue = await plannedCueForAny(user.id, taskIds, input.includeCue);

  await createBlockWithCue(
    {
      userId: user.id,
      taskIds,
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
  const taskIds = await resolveTaskIds(user.id, input.taskIds);

  const { count } = await prisma.timeBlock.updateMany({
    where: { id: input.id, userId: user.id },
    data: {
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

  // Ownership is established by that update, so the list can be rewritten on
  // the block id alone. Kept ticks survive — see syncBlockTasks.
  await syncBlockTasks(user.id, input.id, taskIds);

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
    cue = await plannedCueForAny(user.id, taskIds, input.includeCue);
    if (cue) {
      const cueSpan = cueSpanFor(span, cue.minutes);
      if (cueSpan) {
        await createCueBlock(prisma, cue, {
          userId: user.id,
          date,
          span: cueSpan,
          cueForId: input.id,
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
  if (!parsed.success) {
    // The optimistic layer has already moved the block on screen; revalidate
    // anyway so a bad payload can't leave the server cache disagreeing with
    // what the user is looking at.
    revalidateCalendar();
    return;
  }

  const date = parseLocalDate(parsed.data.date);
  if (!date) {
    revalidateCalendar();
    return;
  }

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
 * Every block lands at 15 minutes — the estimate is information, not a
 * constraint, and a task with no estimate gets the same honest block as one
 * with a careful estimate. The length is deliberately coerced here rather than
 * trusted from the wire: a stale drag payload cannot sneak a different length
 * in. The resize handle and the editor are how it moves afterwards.
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
    select: { id: true, title: true },
  });

  if (!task) return { status: "error", message: "That task no longer exists." };

  const minutes = PLAN_DEFAULT_MINUTES;

  const cue = await plannedCueFor(user.id, task.id, input.includeCue);
  const cueMinutes = cue?.minutes ?? 0;

  // Daydream blocks claim nothing, so they don't shrink the gaps a real
  // block can land in — "Fit it in" may place a task on top of one.
  const existing = (
    await prisma.timeBlock.findMany({
      where: { userId: user.id, date },
      select: { startMinute: true, endMinute: true, kind: true },
      orderBy: { startMinute: "asc" },
    })
  )
    .filter((block) => block.kind !== "DAYDREAM")
    .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));

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
      taskIds: [task.id],
      // Named after the task it is for. The block is a snapshot: renaming the
      // task later leaves the calendar as it was planned.
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

/**
 * "This belongs in that two hours."
 *
 * The counterpart to `scheduleTask`: the time is already claimed, so dropping a
 * task onto an existing block adds it to the list rather than making a second
 * block on the same minutes. Idempotent — dropping the same task twice is a
 * no-op, not a duplicate line.
 *
 * The block's own tick is reconciled afterwards, because a block that was
 * ticked off and has just been given another task is, by its own rule, no
 * longer done.
 */
export async function addTaskToBlock(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = addTaskToBlockSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    revalidateCalendar();
    return;
  }

  // One read establishes ownership of both ends: the block through its owner,
  // the task through its own userId. Neither id is trusted on its own.
  const [block, task] = await Promise.all([
    prisma.timeBlock.findFirst({
      where: { id: parsed.data.blockId, userId: user.id },
      select: { id: true, tasks: { select: { position: true } } },
    }),
    prisma.task.findFirst({
      where: { id: parsed.data.taskId, userId: user.id },
      select: { id: true },
    }),
  ]);

  if (!block || !task) {
    revalidateCalendar();
    return;
  }

  // The cap holds on this path too, not only in the editor: a block is a
  // stretch of time you are going to spend, and a drag is not a reason to let
  // it grow into a backlog.
  if (block.tasks.length >= MAX_BLOCK_TASKS) {
    revalidateCalendar();
    return;
  }

  const next = block.tasks.reduce((max, link) => Math.max(max, link.position), -1) + 1;

  await prisma.timeBlockTask.upsert({
    where: { blockId_taskId: { blockId: block.id, taskId: task.id } },
    update: {},
    create: { blockId: block.id, taskId: task.id, position: next },
  });

  await reconcileBlockCompletion(user.id, block.id);

  revalidateCalendar();
}

/**
 * Tick one task off inside its block.
 *
 * Block-scoped by design: the write lands on the join row and never on the
 * task. Finishing "pull the charts" inside the 9am block is evidence about the
 * morning; whether the task itself is done is a separate claim the person makes
 * on /tasks. Conflating them would either lie about the task or make you afraid
 * to tick.
 */
export async function toggleBlockTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = toggleBlockTaskSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    // Same reasoning as moveBlock and toggleBlockDone: the tick was already
    // flipped on screen, so the cache still has to agree with what is drawn.
    revalidateCalendar();
    return;
  }

  const { blockId, taskId, done } = parsed.data;

  const { count } = await prisma.timeBlockTask.updateMany({
    // Ownership through the block, so the pair of ids can't address a row on
    // someone else's calendar.
    where: { blockId, taskId, block: { userId: user.id } },
    data: { doneAt: done ? new Date() : null },
  });

  if (count === 0) {
    revalidateCalendar();
    return;
  }

  await reconcileBlockCompletion(user.id, blockId);

  revalidateCalendar();
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
 *
 * It *does* carry the whole task list with it, in both directions. "This
 * stretch is done" cannot leave a line inside it unticked — that would be the
 * block disagreeing with itself — and re-opening the block has to give the
 * lines back, or un-ticking would be a one-way door.
 */
export async function toggleBlockDone(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) {
    // Same reasoning as moveBlock: the tick was already flipped on screen.
    revalidateCalendar();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.timeBlock.updateMany({
      where: { id, userId: user.id },
      data: { completedAt: done ? new Date() : null },
    });

    // Ownership is established by that update, so the lines can be written on
    // the block id alone.
    if (count === 0) return;

    await tx.timeBlockTask.updateMany({
      where: { blockId: id },
      data: { doneAt: done ? new Date() : null },
    });
  });

  revalidateCalendar();
}

/**
 * Turn ids off the wire into ids that are really this user's.
 *
 * Silently drops the ones that aren't rather than refusing the whole write: a
 * task deleted in another tab while the editor was open should cost you that
 * one line, not the block. Order is preserved for the same reason `position`
 * exists at all — stable rendering, not priority.
 */
async function resolveTaskIds(
  userId: string,
  taskIds: string[],
): Promise<string[]> {
  const wanted = [...new Set(taskIds)];
  if (wanted.length === 0) return [];

  const owned = await prisma.task.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });

  const allowed = new Set(owned.map((task) => task.id));
  return wanted.filter((id) => allowed.has(id));
}
