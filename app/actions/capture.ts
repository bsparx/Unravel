"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import { captureSchema } from "@/lib/validation";

/**
 * Save a thought, verbatim.
 *
 * Lives outside both route groups because the dump box is mounted in a layout
 * shared by them, and a Client Component in either must be able to import it.
 *
 * Note what this does NOT do: no parsing, no project, no estimate, no due date.
 * Every one of those is a decision, and a decision at capture time is a reason
 * not to capture at all. Triage happens later, at /inbox.
 */
export async function captureThought(
  body: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  const parsed = captureSchema.safeParse({ body });

  if (!parsed.success) {
    return { ok: false, message: "Nothing to save yet." };
  }

  await prisma.capture.create({
    data: {
      userId: user.id,
      body: parsed.data.body,
      localDate: todayLocal(user.timezone),
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/");

  return { ok: true };
}
