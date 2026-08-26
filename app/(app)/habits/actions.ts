"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVERY_DAY, parseLocalDate, todayLocal } from "@/lib/dates";
import { cueEdges, wouldCycle } from "@/lib/habit-cue";
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

/** What gets written to `HabitCue`, or null for "no cue". */
type CueWrite = {
  anchorTaskId: string | null;
  anchorLabel: string | null;
  anchorMinutes: number;
};

type CueInput = {
  cueMode: "none" | "habit" | "label";
  cueTaskId?: string;
  cueLabel?: string;
  cueMinutes: number;
};

/**
 * Turn the form's cue fields into a row, or refuse.
 *
 * Ownership and the cycle check live together because they are the same
 * question asked twice: is this anchor a thing this user may legally point at.
 * A foreign or vanished id resolves to "no cue" rather than an error — the same
 * posture as `resolveProjectId` — but a cycle is reported, because it is a
 * coherent request with a genuinely wrong answer, and dropping it silently
 * would look like the save didn't take.
 *
 * `habitId` is null on create: a habit that doesn't exist yet has nothing
 * pointing at it, so no chain can lead back to it and the edge query is skipped.
 */
async function resolveCue(
  userId: string,
  habitId: string | null,
  input: CueInput,
): Promise<
  { ok: true; cue: CueWrite | null } | { ok: false; state: ActionState }
> {
  if (input.cueMode === "none") return { ok: true, cue: null };

  if (input.cueMode === "label") {
    return {
      ok: true,
      cue: {
        anchorTaskId: null,
        anchorLabel: input.cueLabel ?? null,
        anchorMinutes: input.cueMinutes,
      },
    };
  }

  const anchor = input.cueTaskId
    ? await prisma.task.findFirst({
        where: { id: input.cueTaskId, userId, type: "HABIT" },
        select: { id: true },
      })
    : null;

  if (!anchor) return { ok: true, cue: null };

  if (habitId) {
    const rows = await prisma.habitCue.findMany({
      where: { task: { userId }, anchorTaskId: { not: null } },
      select: { taskId: true, anchorTaskId: true },
    });

    if (wouldCycle(habitId, anchor.id, cueEdges(rows))) {
      return {
        ok: false,
        state: {
          status: "error",
          message: "That would stack the habit on itself.",
          fieldErrors: {
            cueTaskId:
              "This habit already comes before that one, somewhere down the chain.",
          },
        },
      };
    }
  }

  return {
    ok: true,
    cue: {
      anchorTaskId: anchor.id,
      anchorLabel: null,
      anchorMinutes: input.cueMinutes,
    },
  };
}

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

  const cue = await resolveCue(user.id, null, input);
  if (!cue.ok) return cue.state;

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
      color: input.color,
      requiresFeedback: input.requiresFeedback,
      feedbackPrompt: input.feedbackPrompt ?? null,
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
          timeAnchor: input.timeAnchor ?? null,
          slots: input.slots,
        },
      },
      cue: cue.cue ? { create: cue.cue } : undefined,
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
    select: {
      id: true,
      recurrence: { select: { startDate: true } },
      cue: { select: { taskId: true } },
    },
  });

  if (!owned) {
    return { status: "error", message: "That habit no longer exists." };
  }

  const cue = await resolveCue(user.id, owned.id, input);
  if (!cue.ok) return cue.state;

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
      color: input.color,
      requiresFeedback: input.requiresFeedback,
      feedbackPrompt: input.feedbackPrompt ?? null,
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
            timeAnchor: input.timeAnchor ?? null,
            slots: input.slots,
          },
          update: {
            kind: isEveryDay(input.daysOfWeek) ? "DAILY" : "SPECIFIC_DAYS",
            daysOfWeek: input.daysOfWeek,
            startDate,
            endDate: input.endDate ? parseLocalDate(input.endDate) : null,
            unit: input.unit,
            minimumQuota: input.minimumQuota,
            optimalQuota: input.optimalQuota ?? null,
            timeAnchor: input.timeAnchor ?? null,
            slots: input.slots,
          },
        },
      },
      // `delete: true` throws on an absent 1-1, so clearing the cue is only
      // asked for when there is one to clear.
      cue: cue.cue
        ? { upsert: { create: cue.cue, update: cue.cue } }
        : owned.cue
          ? { delete: true }
          : undefined,
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

/**
 * Delete a habit and everything it ever touched. The one irreversible action
 * in the app, and the counterpart to archiving rather than a shortcut for it.
 *
 * Sessions and blocks are `SetNull` at the schema level, so a bare
 * `task.delete()` would leave both behind — orphaned sessions still billing
 * time on /stats for a habit that no longer exists. "Permanently" has to mean
 * those go too, so they're taken explicitly, first, while the `taskId` that
 * identifies them is still there to match on. Steps, recurrence and the whole
 * occurrence history cascade from the task; `SessionInterval` cascades from
 * the sessions.
 *
 * `HabitCue` cascades from both of its FKs, so this habit's own cue goes and so
 * does any cue that named it as an anchor — a habit stacked on one that no
 * longer exists has lost its trigger, and a dangling row would render as
 * "After " with nothing after it.
 *
 * `DayLog.selectedTaskId` and `Capture.promotedTaskId` stay `SetNull` on
 * purpose — those rows are a day's record and an inbox note, which are the
 * user's own writing and not the habit's data to take with it.
 */
export async function deleteHabit(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  await prisma.$transaction(async (tx) => {
    // Ownership is established once, here, so the child deletes below can
    // match on `taskId` alone without each becoming its own way to reach
    // another user's rows by guessing an id.
    const habit = await tx.task.findFirst({
      where: { id: taskId, userId: user.id, type: "HABIT" },
      select: { id: true },
    });
    if (!habit) return;

    await tx.focusSession.deleteMany({ where: { taskId: habit.id } });
    await tx.timeBlock.deleteMany({ where: { taskId: habit.id } });
    await tx.task.delete({ where: { id: habit.id } });
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
