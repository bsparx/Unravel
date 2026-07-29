"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseQuickAdd } from "@/lib/quick-parse";
import { promoteCaptureSchema } from "@/lib/validation";

function revalidateInbox() {
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/tasks");
}

/**
 * Turn a captured thought into a task.
 *
 * This is where shorthand finally gets parsed — at triage time, when you are
 * already in a deciding frame of mind. "Email the landlord 20m #Admin p1"
 * arrives as plain text and leaves as a task with an estimate and a list.
 *
 * The capture row is kept and marked PROMOTED rather than deleted, so the
 * record that the thought existed outlives whatever became of it.
 */
export async function promoteCapture(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = promoteCaptureSchema.safeParse({
    captureId: formData.get("captureId"),
  });
  if (!parsed.success) return;

  const capture = await prisma.capture.findFirst({
    where: { id: parsed.data.captureId, userId: user.id, status: "RAW" },
  });
  if (!capture) return;

  const { title, minutes, projectName, priority } = parseQuickAdd(capture.body);

  // A capture that was pure shorthand has no title; fall back to the raw text
  // rather than creating a nameless task.
  const taskTitle = (title || capture.body).slice(0, 200);

  let projectId: string | null = null;
  if (projectName) {
    const project = await prisma.project.upsert({
      where: { userId_name: { userId: user.id, name: projectName } },
      create: { userId: user.id, name: projectName, sortOrder: Date.now() },
      update: {},
    });
    projectId = project.id;
  }

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      type: "TODO",
      title: taskTitle,
      priority,
      projectId,
      estimatedSeconds: minutes ? minutes * 60 : null,
      sortOrder: Date.now(),
    },
  });

  await prisma.capture.update({
    where: { id: capture.id },
    data: { status: "PROMOTED", promotedTaskId: task.id },
  });

  revalidateInbox();
}

/**
 * Let it go. Kept rather than deleted — what you repeatedly decide not to do
 * is worth being able to look at.
 */
export async function dismissCapture(formData: FormData): Promise<void> {
  const user = await requireUser();
  const captureId = String(formData.get("captureId") ?? "");
  if (!captureId) return;

  await prisma.capture.updateMany({
    where: { id: captureId, userId: user.id, status: "RAW" },
    data: { status: "DISMISSED" },
  });

  revalidateInbox();
}

export async function restoreCapture(formData: FormData): Promise<void> {
  const user = await requireUser();
  const captureId = String(formData.get("captureId") ?? "");
  if (!captureId) return;

  await prisma.capture.updateMany({
    where: { id: captureId, userId: user.id, status: "DISMISSED" },
    data: { status: "RAW" },
  });

  revalidateInbox();
}
