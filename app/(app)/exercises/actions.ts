"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  type ActionState,
  fieldErrorsFrom,
  formValues,
  routineDaysSchema,
  routineIdSchema,
  routineSlotSchema,
  swapRoutineExerciseSchema,
} from "@/lib/validation";
import { generateRoutine } from "@/lib/exercise-routine";

function revalidateExercises() {
  revalidatePath("/exercises");
}

/** Name the exact days, then generate and persist the routine. */
export async function createRoutine(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = routineDaysSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { daysPerWeek, days, counts, equipment } = parsed.data;
  if (days.length !== daysPerWeek) {
    return {
      status: "error",
      message: `Pick exactly ${daysPerWeek} days.`,
      fieldErrors: { days: `Pick exactly ${daysPerWeek} days.` },
    };
  }

  const exercises = await prisma.exercise.findMany({
    where: { active: true },
    select: { id: true, equipment: true, goal: true },
    orderBy: { sortOrder: "asc" },
  });

  const slots = generateRoutine({
    days,
    counts,
    exercises,
    equipment: equipment === "MIX" ? null : equipment,
  });

  await prisma.exerciseRoutine.create({
    data: {
      userId: user.id,
      name: "Weekly routine",
      equipment,
      daysOfWeek: days,
      exercises: {
        create: slots.map((slot) => ({
          exerciseId: slot.exerciseId,
          dayOfWeek: slot.dayOfWeek,
          position: slot.position,
        })),
      },
    },
  });

  revalidateExercises();
  return { status: "success", message: "Routine built." };
}

/** Swap one slot for a different exercise, pinning it against regeneration. */
export async function swapRoutineExercise(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = swapRoutineExerciseSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { routineId, dayOfWeek, position, exerciseId } = parsed.data;

  const routine = await prisma.exerciseRoutine.findFirst({
    where: { id: routineId, userId: user.id },
    select: { id: true },
  });
  if (!routine) {
    return { status: "error", message: "That routine is gone." };
  }

  // The target exercise exists and is live.
  const target = await prisma.exercise.findFirst({
    where: { id: exerciseId, active: true },
    select: { id: true },
  });
  if (!target) {
    return { status: "error", message: "That exercise is gone." };
  }

  // One day never carries the same exercise twice.
  const duplicate = await prisma.routineExercise.findFirst({
    where: {
      routineId,
      dayOfWeek,
      exerciseId,
      NOT: { position },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      status: "error",
      message: "That exercise is already on this day.",
    };
  }

  await prisma.routineExercise.updateMany({
    where: { routineId, dayOfWeek, position },
    data: { exerciseId, swapped: true },
  });

  revalidateExercises();
  return { status: "success", message: "Swapped." };
}

/** Reshuffle every slot the person hasn't pinned. */
export async function regenerateRoutine(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = routineIdSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const routine = await prisma.exerciseRoutine.findFirst({
    where: { id: parsed.data.routineId, userId: user.id },
    include: { exercises: true },
  });
  if (!routine) {
    return { status: "error", message: "That routine is gone." };
  }

  // A fresh seed every click: the generator is deterministic per variant, so
  // a random variant is what makes "Regenerate" actually reshuffle. (The
  // previous seed came from the routine's `updatedAt`, which never moves —
  // regeneration only writes slot rows — so every click returned the
  // identical routine.)
  const variant = Math.floor(Math.random() * 1_000_000);
  const exercises = await prisma.exercise.findMany({
    where: { active: true },
    select: { id: true, equipment: true, goal: true },
    orderBy: { sortOrder: "asc" },
  });

  const pinned = routine.exercises
    .filter((slot) => slot.swapped)
    .map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      position: slot.position,
      exerciseId: slot.exerciseId,
    }));

  // The week's shape is part of the plan: regeneration reshuffles exercises
  // but keeps each day's count exactly as it was built.
  const slotsByDay = new Map<number, number>();
  for (const slot of routine.exercises) {
    slotsByDay.set(slot.dayOfWeek, (slotsByDay.get(slot.dayOfWeek) ?? 0) + 1);
  }
  const counts = routine.daysOfWeek.map((day) => slotsByDay.get(day) ?? 3);

  const slots = generateRoutine({
    days: routine.daysOfWeek,
    counts,
    exercises,
    equipment: routine.equipment === "MIX" ? null : routine.equipment,
    variant,
    pinned,
    // Push what's on screen down the ranking, so consecutive clicks walk the
    // catalog instead of circling the same handful of exercises.
    avoid: routine.exercises.map((slot) => slot.exerciseId),
  });

  // Only the unpinned slots move; the person's picks stay put.
  const pinnedKeys = new Set(
    pinned.map((p) => `${p.dayOfWeek}:${p.position}`),
  );
  const before = new Map(
    routine.exercises.map((slot) => [
      `${slot.dayOfWeek}:${slot.position}`,
      slot.exerciseId,
    ]),
  );
  let moved = 0;

  await prisma.$transaction(async (tx) => {
    for (const slot of slots) {
      const key = `${slot.dayOfWeek}:${slot.position}`;
      if (pinnedKeys.has(key)) continue;
      if (before.get(key) !== slot.exerciseId) moved += 1;
      await tx.routineExercise.updateMany({
        where: {
          routineId: routine.id,
          dayOfWeek: slot.dayOfWeek,
          position: slot.position,
        },
        data: { exerciseId: slot.exerciseId },
      });
    }
  });

  revalidateExercises();
  return {
    status: "success",
    message:
      moved === 0
        ? "Every slot is pinned — nothing left to reshuffle."
        : `${moved} ${moved === 1 ? "exercise" : "exercises"} swapped out.`,
  };
}

/** Release a swapped slot so regeneration can move it again. */
export async function unpinRoutineExercise(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = routineSlotSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { routineId, dayOfWeek, position } = parsed.data;

  const routine = await prisma.exerciseRoutine.findFirst({
    where: { id: routineId, userId: user.id },
    select: { id: true },
  });
  if (!routine) {
    return { status: "error", message: "That routine is gone." };
  }

  await prisma.routineExercise.updateMany({
    where: { routineId, dayOfWeek, position },
    data: { swapped: false },
  });

  revalidateExercises();
  return { status: "success", message: "Unpinned — it can move again." };
}

/** Replace the whole routine with a fresh builder run. */
export async function deleteRoutine(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = routineIdSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  await prisma.exerciseRoutine.deleteMany({
    where: { id: parsed.data.routineId, userId: user.id },
  });

  revalidateExercises();
  return { status: "success", message: "Routine removed." };
}
