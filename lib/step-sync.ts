import "server-only";

import { prisma } from "@/lib/db";
import type { StepInput } from "@/lib/validation";

/**
 * A plain module rather than an export from a `"use server"` file.
 *
 * Everything exported from an actions file becomes a POST endpoint, and this
 * function takes `userId` as an argument — as an endpoint it would let anyone
 * rewrite anyone's checklist. Shared server helpers belong here.
 */

export const toStepRow = (step: StepInput, index: number) => ({
  title: step.title,
  position: index,
  estimatedSeconds: step.estimateMinutes ? step.estimateMinutes * 60 : null,
});

/** For `prisma.task.create({ data: { steps: { create: ... } } })`. */
export const stepCreateRows = (userId: string, steps: StepInput[]) =>
  steps.map((step, index) => ({ userId, ...toStepRow(step, index) }));

/**
 * Reconcile a task's steps against what the editor sent.
 *
 * Not delete-all-then-recreate: steps carry `completedAt`, and wiping it
 * because you fixed a typo in the task title would be a small betrayal of the
 * one thing a checklist is for. Rows with an id are updated in place (which
 * preserves the tick), rows without are new, and anything the editor no longer
 * mentions was deleted by the user.
 *
 * One transaction, so a task can never be left holding half a checklist.
 */
export async function syncSteps(
  userId: string,
  taskId: string,
  steps: StepInput[],
): Promise<void> {
  const keptIds = steps
    .map((step) => step.id)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction([
    prisma.taskStep.deleteMany({
      where: {
        taskId,
        userId,
        ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
      },
    }),
    ...steps.map((step, index) =>
      step.id
        ? // updateMany, not update: scoped by taskId + userId, so an id
          // belonging to someone else's task matches zero rows instead of
          // throwing — or worse, succeeding.
          prisma.taskStep.updateMany({
            where: { id: step.id, taskId, userId },
            data: toStepRow(step, index),
          })
        : prisma.taskStep.create({
            data: { userId, taskId, ...toStepRow(step, index) },
          }),
    ),
  ]);
}
