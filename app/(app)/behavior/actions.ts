"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { behaviorTagSchema } from "@/lib/validation";

export type BehaviorTag = {
  id: string;
  name: string;
  description: string | null;
  system: boolean;
};

/** The picker's full set: built-ins first, then this user's custom tags. */
export async function listBehaviorTags(): Promise<BehaviorTag[]> {
  const user = await requireUser();
  const tags = await prisma.tag.findMany({
    where: { OR: [{ userId: null }, { userId: user.id }] },
    orderBy: [{ system: "desc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, system: true },
  });
  return tags;
}

export async function createCustomTag(
  name: string,
): Promise<{ ok: true; tag: BehaviorTag } | { ok: false; message: string }> {
  const user = await requireUser();
  const parsed = behaviorTagSchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false, message: "Name it in a few words." };
  }

  // A custom tag can't collide with a built-in: those names belong to the
  // shared set, and a user shadowing "Bored" would break the meaning of the
  // tooltip the presets were built around.
  const exists = await prisma.tag.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      OR: [{ userId: null }, { userId: user.id }],
    },
    select: { id: true },
  });
  if (exists) {
    return { ok: false, message: "That tag already exists." };
  }

  const tag = await prisma.tag.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      system: false,
    },
    select: { id: true, name: true, description: true, system: true },
  });

  revalidatePath("/behavior");
  return { ok: true, tag };
}

/**
 * Delete a custom tag. Built-ins are refused outright — they belong to
 * everyone. Deleting a custom tag keeps its entries (Capture.tagId is SetNull)
 * and detaches it from anything pending in the dump box.
 */
export async function deleteCustomTag(
  tagId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId: user.id },
    select: { id: true },
  });
  if (!tag) {
    return { ok: false, message: "That tag isn't yours to delete." };
  }

  await prisma.tag.delete({ where: { id: tag.id } });
  revalidatePath("/behavior");
  return { ok: true };
}
