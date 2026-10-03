"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { IdentityKind } from "@/lib/generated/prisma/client";
import { MAX_IDENTITIES, nextFreeSlot } from "@/lib/identity-look";
import {
  identitySchema,
  setIdentityHabitsSchema,
  setLeadSchema,
  updateIdentitySchema,
} from "@/lib/validation";

/** The character half of an identity. Every field optional. */
export type IdentityProfileInput = {
  kind?: IdentityKind | null;
  archetype?: string | null;
  question?: string | null;
  colorSlot?: number;
  sigil?: string | null;
};

export type IdentityRecord = {
  id: string;
  name: string;
  statement: string | null;
  characteristics: string | null;
};

/**
 * Every surface that shows a name, a link or a tally reads one of these three
 * pages, so a write to any of them revalidates all three.
 */
function revalidateIdentityViews() {
  revalidatePath("/identities");
  revalidatePath("/habits");
  revalidatePath("/habits/stats");
  revalidatePath("/day");
  revalidatePath("/calendar");
  revalidatePath("/timer");
  revalidatePath("/treats");
  revalidatePath("/review");
  revalidatePath("/");
}

type Result = { ok: true } | { ok: false; message: string };

/** The picker's set — used by the habit form's identity chips. */
export async function listIdentities(): Promise<IdentityRecord[]> {
  const user = await requireUser();
  const identities = await prisma.identity.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, statement: true, characteristics: true },
  });
  return identities;
}

/**
 * Add an identity. `name` is all the habit form's inline "+ New" chip sends —
 * the statement can wait until /identities, because stopping mid-form to write
 * an essay is exactly the wrong trade for someone with thirteen tabs open.
 */
export async function createIdentity(
  name: string,
  statement?: string | null,
  characteristics?: string | null,
  profile: IdentityProfileInput = {},
): Promise<{ ok: true; identity: IdentityRecord } | { ok: false; message: string }> {
  const user = await requireUser();
  const parsed = identitySchema.safeParse({ name, statement, characteristics, ...profile });
  if (!parsed.success) {
    return { ok: false, message: "Name it in a few words." };
  }

  // One identity per hue: past six, colours would repeat and the charts and
  // calendar could no longer tell two selves apart. It is also plenty.
  const existing = await prisma.identity.findMany({
    where: { userId: user.id },
    select: { colorSlot: true },
  });
  if (existing.length >= MAX_IDENTITIES) {
    return {
      ok: false,
      message: "Six identities is the most Unravel holds. Fewer selves means more votes for each.",
    };
  }

  // Case-insensitive, like behavior tags: "Writer" and "writer" are one self.
  // Two identities with one name would each hold half the votes and both would
  // read as neglected — a worse failure than refusing the second name.
  const exists = await prisma.identity.findFirst({
    where: {
      userId: user.id,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (exists) {
    return { ok: false, message: "That identity already exists." };
  }

  const identity = await prisma.identity.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      statement: parsed.data.statement ?? null,
      characteristics: parsed.data.characteristics ?? null,
      kind: parsed.data.kind ?? null,
      archetype: parsed.data.archetype ?? null,
      question: parsed.data.question ?? null,
      sigil: parsed.data.sigil ?? null,
      colorSlot:
        parsed.data.colorSlot ?? nextFreeSlot(existing.map((row) => row.colorSlot)),
      sortOrder: Date.now(),
    },
    select: { id: true, name: true, statement: true, characteristics: true },
  });

  revalidateIdentityViews();
  return { ok: true, identity };
}

export async function updateIdentity(
  input: {
    id: string;
    name: string;
    statement?: string | null;
    characteristics?: string | null;
  } & IdentityProfileInput,
): Promise<Result> {
  const user = await requireUser();
  const parsed = updateIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That didn't look right." };
  }

  const owned = await prisma.identity.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true },
  });
  if (!owned) {
    return { ok: false, message: "That identity isn't yours." };
  }

  // The unique name check, minus the row being edited — "Writer" may keep its
  // own name while fixing its statement.
  const clash = await prisma.identity.findFirst({
    where: {
      userId: user.id,
      id: { not: owned.id },
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: "That identity already exists." };
  }

  await prisma.identity.update({
    where: { id: owned.id },
    data: {
      name: parsed.data.name,
      statement: parsed.data.statement ?? null,
      characteristics: parsed.data.characteristics ?? null,
      kind: parsed.data.kind ?? null,
      archetype: parsed.data.archetype ?? null,
      question: parsed.data.question ?? null,
      sigil: parsed.data.sigil ?? null,
      ...(parsed.data.colorSlot ? { colorSlot: parsed.data.colorSlot } : {}),
    },
  });

  revalidateIdentityViews();
  return { ok: true };
}

/**
 * Delete an identity. Its links go with it (HabitIdentity cascades); the
 * habits and their history stand. Since the tally reads history through the
 * current links, the votes this identity earned disappear from *its* view —
 * not from the habits that earned them.
 */
export async function deleteIdentity(identityId: string): Promise<Result> {
  const user = await requireUser();
  const identity = await prisma.identity.findFirst({
    where: { id: identityId, userId: user.id },
    select: { id: true },
  });
  if (!identity) {
    return { ok: false, message: "That identity isn't yours to delete." };
  }

  await prisma.identity.delete({ where: { id: identity.id } });
  revalidateIdentityViews();
  return { ok: true };
}

/**
 * The identity-side setter: this identity is voted for by exactly these habits.
 *
 * Set semantics — the request is the whole answer, so a habit dropped from the
 * list is unlinked. Ids that aren't this user's habits quietly drop out rather
 * than failing: the same posture as `resolveProjectId`, a stale id off the
 * wire finds nothing rather than someone else's task.
 */
export async function setIdentityHabits(
  identityId: string,
  taskIds: string[],
): Promise<Result> {
  const user = await requireUser();
  const parsed = setIdentityHabitsSchema.safeParse({ identityId, taskIds });
  if (!parsed.success) {
    return { ok: false, message: "Too many habits for one identity." };
  }

  const identity = await prisma.identity.findFirst({
    where: { id: parsed.data.identityId, userId: user.id },
    select: { id: true },
  });
  if (!identity) {
    return { ok: false, message: "That identity isn't yours." };
  }

  const wanted = [...new Set(parsed.data.taskIds)];
  const habits = await prisma.task.findMany({
    where: { id: { in: wanted }, userId: user.id, type: "HABIT" },
    select: { id: true },
  });
  const kept = habits.map((habit) => habit.id);

  await prisma.$transaction([
    prisma.habitIdentity.deleteMany({
      where: { identityId: identity.id, taskId: { notIn: kept } },
    }),
    prisma.habitIdentity.createMany({
      data: kept.map((taskId) => ({ identityId: identity.id, taskId })),
      skipDuplicates: true,
    }),
  ]);

  revalidateIdentityViews();
  return { ok: true };
}
/**
 * Who leads today. Writes the day's own choice onto the DayLog (created
 * lazily, like every DayLog). Null clears it back to the week's lead.
 */
export async function setLeadIdentity(identityId: string | null): Promise<Result> {
  const user = await requireUser();
  const parsed = setLeadSchema.safeParse({ identityId });
  if (!parsed.success) return { ok: false, message: "That didn't look right." };

  if (parsed.data.identityId) {
    const owned = await prisma.identity.findFirst({
      where: { id: parsed.data.identityId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { ok: false, message: "That identity isn't yours." };
  }

  const date = todayLocal(user.timezone);
  await prisma.dayLog.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, leadIdentityId: parsed.data.identityId },
    update: { leadIdentityId: parsed.data.identityId },
  });

  revalidateIdentityViews();
  return { ok: true };
}
