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
 * not to capture at all. The one thing it asks for is the tag — because naming
 * the state is the whole point of a behavior log.
 */
export async function captureThought(
  body: string,
  tagId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  const parsed = captureSchema.safeParse({ body, tagId });

  if (!parsed.success) {
    return { ok: false, message: "Write the moment, then pick what was behind it." };
  }

  // The tag must be the user's own or a built-in — never someone else's.
  const tag = await prisma.tag.findFirst({
    where: {
      id: parsed.data.tagId,
      OR: [{ userId: null }, { userId: user.id }],
    },
    select: { id: true },
  });
  if (!tag) {
    return { ok: false, message: "That tag isn't available." };
  }

  await prisma.capture.create({
    data: {
      userId: user.id,
      body: parsed.data.body,
      tagId: tag.id,
      localDate: todayLocal(user.timezone),
    },
  });

  revalidatePath("/behavior");
  revalidatePath("/");

  return { ok: true };
}
