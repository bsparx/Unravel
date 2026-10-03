"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { cuid, markShadowSchema, shadowPatternSchema } from "@/lib/validation";

type Result = { ok: true } | { ok: false; message: string };

/** A chosen-otherwise mark is a vote, so every vote surface hears about it. */
function revalidateShadowViews() {
  revalidatePath("/habits");
  revalidatePath("/identities");
  revalidatePath("/day");
  revalidatePath("/treats");
  revalidatePath("/review");
}

async function ownedIdentity(userId: string, identityId: string | null | undefined) {
  if (!identityId) return null;
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId },
    select: { id: true },
  });
  return identity?.id ?? null;
}

export async function createShadowPattern(input: {
  name: string;
  law?: string | null;
  plan?: string | null;
  identityId?: string | null;
}): Promise<Result> {
  const user = await requireUser();
  const parsed = shadowPatternSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "That didn't look right." };
  }

  await prisma.shadowPattern.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      law: parsed.data.law ?? null,
      plan: parsed.data.plan ?? null,
      identityId: await ownedIdentity(user.id, parsed.data.identityId),
      sortOrder: Date.now(),
    },
  });
  revalidateShadowViews();
  return { ok: true };
}

/** Let a pattern go. Archived, not deleted: its past choices stay votes. */
export async function archiveShadowPattern(patternId: string): Promise<Result> {
  const user = await requireUser();
  if (!cuid.safeParse(patternId).success) return { ok: false, message: "That didn't look right." };
  const { count } = await prisma.shadowPattern.updateMany({
    where: { id: patternId, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0) return { ok: false, message: "That pattern isn't yours." };
  revalidateShadowViews();
  return { ok: true };
}

/** Today's mark: noticed, chose otherwise, or cleared. One upsert or delete. */
export async function markShadow(patternId: string, mark: "NOTICED" | "CHOSE" | null): Promise<Result> {
  const user = await requireUser();
  const parsed = markShadowSchema.safeParse({ patternId, mark });
  if (!parsed.success) return { ok: false, message: "That didn't look right." };

  const pattern = await prisma.shadowPattern.findFirst({
    where: { id: parsed.data.patternId, userId: user.id },
    select: { id: true },
  });
  if (!pattern) return { ok: false, message: "That pattern isn't yours." };

  const date = todayLocal(user.timezone);
  if (parsed.data.mark === null) {
    await prisma.shadowLog.deleteMany({ where: { patternId: pattern.id, date } });
  } else {
    await prisma.shadowLog.upsert({
      where: { patternId_date: { patternId: pattern.id, date } },
      create: { userId: user.id, patternId: pattern.id, date, mark: parsed.data.mark },
      update: { mark: parsed.data.mark },
    });
  }
  revalidateShadowViews();
  return { ok: true };
}
