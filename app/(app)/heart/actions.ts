"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { itemsToBody } from "@/lib/practices";
import { CUSTOM_PREFIX, SET_MAX_ITEMS, findRecitation, readSet } from "@/lib/recitations";
import {
  type ActionState,
  cuid,
  customRecitationSchema,
  fieldErrorsFrom,
  formValues,
  practiceEntrySchema,
  practiceTemplateSchema,
  recitationSetSchema,
} from "@/lib/validation";

const JOURNAL_KIND = { gratitude: "GRATITUDE", dua: "DUA" } as const;

const invalid = (error: Parameters<typeof fieldErrorsFrom>[0]): ActionState => ({
  status: "error",
  message: "Some of that didn't look right.",
  fieldErrors: fieldErrorsFrom(error),
});

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

  revalidatePath("/heart");
  return { status: "success" };
}

export async function deletePractice(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;
  // Scoped to the two page kinds too, so this can never reach a worry.
  await prisma.journalEntry.deleteMany({
    where: { id: parsed.data, userId: user.id, kind: { in: ["GRATITUDE", "DUA"] } },
  });
  revalidatePath("/heart");
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

  revalidatePath("/heart");
  revalidatePath("/settings");
  return { status: "success" };
}

// ---------------------------------------------------------------- recitation

/** Your own live recitations' ids: what a "custom:" key may point at. */
async function liveCustomIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.customRecitation.findMany({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/**
 * Save the daily set: which recitations, in what order, how many times each.
 * Every key must be a catalogue id or one of your own recitations; anything
 * else is refused rather than silently dropped, so what you see is what's kept.
 */
export async function saveRecitationSet(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = recitationSetSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "That set didn't look right." };
  }

  const customs = await liveCustomIds(user.id);
  const keys = parsed.data.set.map((item) => item.key);
  const unknown = keys.find((key) =>
    key.startsWith(CUSTOM_PREFIX) ? !customs.has(key.slice(CUSTOM_PREFIX.length)) : !findRecitation(key),
  );
  if (unknown) return { status: "error", message: "One of those recitations isn't available any more." };
  if (new Set(keys).size !== keys.length) return { status: "error", message: "Each recitation can be in the set once." };

  await prisma.user.update({ where: { id: user.id }, data: { recitationSet: parsed.data.set } });
  revalidatePath("/heart");
  return { status: "success" };
}

/**
 * Today's whole set, recited: the day counts for the oasis. The set is read
 * from the database, not the client, and kept with the day as it was.
 * Reciting again the same day changes nothing.
 */
export async function completeRecitation(): Promise<ActionState> {
  const user = await requireUser();
  const customs = await liveCustomIds(user.id);
  const items = readSet(user.recitationSet, customs);
  const date = todayLocal(user.timezone);

  await prisma.recitationLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, items },
    update: {},
  });

  revalidatePath("/heart");
  return { status: "success" };
}

/** Take today back: for a set marked by mistake. */
export async function undoRecitation(): Promise<void> {
  const user = await requireUser();
  await prisma.recitationLog.deleteMany({
    where: { userId: user.id, date: todayLocal(user.timezone) },
  });
  revalidatePath("/heart");
}

/**
 * Write a recitation of your own, or rewrite one. A new one joins the end of
 * the set, said once, so writing it is enough to start saying it.
 */
export async function saveCustomRecitation(formData: FormData): Promise<ActionState & { id?: string }> {
  const user = await requireUser();
  const parsed = customRecitationSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...fields } = parsed.data;
  if (id) {
    const { count } = await prisma.customRecitation.updateMany({
      where: { id, userId: user.id, archivedAt: null },
      data: fields,
    });
    if (count === 0) return { status: "error", message: "That recitation isn't there any more." };
    revalidatePath("/heart");
    return { status: "success", id };
  }

  const customs = await liveCustomIds(user.id);
  const set = readSet(user.recitationSet, customs);
  const created = await prisma.customRecitation.create({ data: { userId: user.id, ...fields } });
  if (set.length < SET_MAX_ITEMS) {
    await prisma.user.update({
      where: { id: user.id },
      data: { recitationSet: [...set, { key: `${CUSTOM_PREFIX}${created.id}`, count: 1 }] },
    });
  }
  revalidatePath("/heart");
  return { status: "success", id: created.id };
}

/**
 * Put one of your recitations away. It leaves the set; past days that held
 * it keep their record.
 */
export async function archiveCustomRecitation(id: string): Promise<void> {
  const user = await requireUser();
  const parsed = cuid.safeParse(id);
  if (!parsed.success) return;

  const { count } = await prisma.customRecitation.updateMany({
    where: { id: parsed.data, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count > 0) {
    const customs = await liveCustomIds(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { recitationSet: readSet(user.recitationSet, customs) },
    });
  }
  revalidatePath("/heart");
}
