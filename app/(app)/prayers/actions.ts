"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseLocalDate } from "@/lib/dates";
import type { PrayerKind } from "@/lib/generated/prisma/client";
import { PRAYERS } from "@/lib/prayers";

/**
 * Check or uncheck one prayer of one cycle. The UI only offers the button
 * inside the prayer's window; this action trusts that gate but re-scopes
 * everything by userId regardless — the same rule as every other action.
 *
 * Toggle, not set: a mis-tap on the wrong prayer shouldn't be permanent, and
 * the unique constraint makes the create side idempotent.
 */
export async function togglePrayer(formData: FormData): Promise<void> {
  const user = await requireUser();

  const prayer = formData.get("prayer")?.toString();
  const date = parseLocalDate(formData.get("date")?.toString() ?? "");
  if (!prayer || !PRAYERS.includes(prayer as PrayerKind) || !date) return;

  const where = {
    userId: user.id,
    date,
    prayer: prayer as PrayerKind,
  };

  const existing = await prisma.prayerCheck.findUnique({
    where: { userId_date_prayer: where },
  });

  if (existing) {
    await prisma.prayerCheck.delete({ where: { id: existing.id } });
  } else {
    await prisma.prayerCheck.create({ data: where });
  }

  revalidatePath("/day");
  revalidatePath("/calendar");
}
