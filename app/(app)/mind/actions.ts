"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { itemsToBody } from "@/lib/practices";
import {
  type ActionState,
  cuid,
  disputationSchema,
  fieldErrorsFrom,
  formValues,
  practiceEntrySchema,
  practiceTemplateSchema,
  wishSchema,
  wishStatusSchema,
} from "@/lib/validation";

const JOURNAL_KIND = { gratitude: "GRATITUDE", dua: "DUA" } as const;

const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): ActionState => ({
  status: "error",
  message: "Some of that didn't look right.",
  fieldErrors: fieldErrorsFrom(error),
});

/** Create a wish, or rewrite one. Ids off the wire are always re-scoped. */
export async function saveWish(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = wishSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, wish, outcome, obstacle, plan } = parsed.data;

  if (id) {
    const { count } = await prisma.wish.updateMany({
      where: { id, userId: user.id },
      data: { wish, outcome, obstacle, plan },
    });
    if (count === 0) return { status: "error", message: "That wish no longer exists." };
  } else {
    await prisma.wish.create({
      data: {
        userId: user.id,
        wish,
        outcome,
        obstacle,
        plan,
        // Newest on top: the board sorts by this, descending.
        sortOrder: Date.now(),
      },
    });
  }

  revalidatePath("/mind");
  return { status: "success" };
}

/** Achieved, let go, or brought back. Settling stamps the moment. */
export async function setWishStatus(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = wishStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, status } = parsed.data;
  const { count } = await prisma.wish.updateMany({
    where: { id, userId: user.id },
    data: {
      status,
      settledAt: status === "ACTIVE" ? null : new Date(),
      // Brought back to the board, it goes to the top.
      ...(status === "ACTIVE" ? { sortOrder: Date.now() } : {}),
    },
  });
  if (count === 0) return { status: "error", message: "That wish no longer exists." };

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deleteWish(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.wish.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}

/** Create a disputation, or rewrite one. Empty lenses are stored as null. */
export async function saveDisputation(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = disputationSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...input } = parsed.data;
  const data = {
    adversity: input.adversity,
    belief: input.belief,
    beliefBefore: input.beliefBefore ?? null,
    consequences: input.consequences,
    evidence: input.evidence || null,
    alternatives: input.alternatives || null,
    implications: input.implications || null,
    usefulness: input.usefulness || null,
    energization: input.energization,
    beliefAfter: input.beliefAfter ?? null,
  };

  if (id) {
    const { count } = await prisma.disputation.updateMany({
      where: { id, userId: user.id },
      data,
    });
    if (count === 0) return { status: "error", message: "That entry no longer exists." };
  } else {
    await prisma.disputation.create({ data: { userId: user.id, ...data } });
  }

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deleteDisputation(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  await prisma.disputation.deleteMany({ where: { id: parsed.data, userId: user.id } });
  revalidatePath("/mind");
}

// ---------------------------------------------------------------- daily pages

/**
 * Write today's gratitude or du'a page. One per day per practice: writing
 * again, even with a different template, replaces today's page. The date is
 * today in the user's own zone, never one sent by the client.
 */
export async function savePractice(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = practiceEntrySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Some of that didn't look right.",
    };
  }

  const { kind, template, items } = parsed.data;
  const date = todayLocal(user.timezone);
  const data = { template, items, body: itemsToBody(items) };

  await prisma.journalEntry.upsert({
    where: { userId_date_kind: { userId: user.id, date, kind: JOURNAL_KIND[kind] } },
    create: { userId: user.id, date, kind: JOURNAL_KIND[kind], ...data },
    update: data,
  });

  revalidatePath("/mind");
  return { status: "success" };
}

export async function deletePractice(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  // Scoped to the two Mind kinds too, so this can never reach a worry.
  await prisma.journalEntry.deleteMany({
    where: { id: parsed.data, userId: user.id, kind: { in: ["GRATITUDE", "DUA"] } },
  });
  revalidatePath("/mind");
}

/** Switch template (and n). Pages already written keep their own. */
export async function setPracticeTemplate(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = practiceTemplateSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { kind, template, count } = parsed.data;
  await prisma.user.update({
    where: { id: user.id },
    data:
      kind === "gratitude"
        ? { gratitudeTemplate: template, gratitudeCount: count }
        : { duaTemplate: template, duaCount: count },
  });

  revalidatePath("/mind");
  revalidatePath("/settings");
  return { status: "success" };
}
