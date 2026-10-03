"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { EVERY_DAY, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { MAX_IDENTITIES, nextFreeSlot, shortName } from "@/lib/identity-look";
import { STARTER_IDS, isTaken, starterById } from "@/lib/starter-selves";

const adoptSchema = z.object({ starterId: z.enum(STARTER_IDS) });

type AdoptResult =
  | { ok: true; short: string; habitCount: number }
  | { ok: false; message: string };

/**
 * Begin as a ready-made character: the identity, its habits with their
 * minimums and cues, the links between them, and today's lead, in one go.
 *
 * The identity and its habits are one nested write, so a failure leaves
 * nothing half-made. Setting the lead comes after; if it fails the character
 * is still there, just not leading, which is the state any new identity
 * starts in.
 */
export async function adoptStarterSelf(starterId: string): Promise<AdoptResult> {
  const user = await requireUser();
  const parsed = adoptSchema.safeParse({ starterId });
  const starter = parsed.success ? starterById(parsed.data.starterId) : undefined;
  if (!starter) return { ok: false, message: "That character isn't on the list." };

  const existing = await prisma.identity.findMany({
    where: { userId: user.id },
    select: { name: true, colorSlot: true },
  });
  if (existing.length >= MAX_IDENTITIES) {
    return {
      ok: false,
      message: "Six identities is the most Unravel holds. Fewer selves means more votes for each.",
    };
  }
  if (isTaken(starter, existing.map((row) => row.name))) {
    return { ok: false, message: `${starter.name} is already part of your cast.` };
  }

  const usedSlots = existing.map((row) => row.colorSlot);
  const today = todayLocal(user.timezone);
  const now = Date.now();

  let identityId: string;
  try {
    const identity = await prisma.identity.create({
      data: {
        userId: user.id,
        name: starter.name,
        statement: starter.statement,
        characteristics: starter.characteristics,
        kind: starter.kind,
        archetype: starter.archetype,
        question: starter.question,
        sigil: starter.sigil,
        colorSlot: usedSlots.includes(starter.colorSlot)
          ? nextFreeSlot(usedSlots)
          : starter.colorSlot,
        sortOrder: now,
        habits: {
          create: starter.habits.map((habit, index) => ({
            task: {
              create: {
                userId: user.id,
                type: "HABIT",
                title: habit.title,
                estimatedSeconds: habit.estimateMinutes * 60,
                sortOrder: now + index,
                recurrence: {
                  create: {
                    kind: "DAILY",
                    daysOfWeek: EVERY_DAY,
                    startDate: today,
                    minimalTask: habit.minimalTask,
                    // ALWAYS, not the cue's window: someone signing up at
                    // 22:00 should still see the habits they just picked.
                    slots: ["ALWAYS"],
                  },
                },
                cue: { create: { anchorLabel: habit.cue } },
              },
            },
          })),
        },
      },
      select: { id: true },
    });
    identityId = identity.id;
  } catch (error) {
    // Two taps racing past the name check meet the unique index instead.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: `${starter.name} is already part of your cast.` };
    }
    throw error;
  }

  await prisma.dayLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    create: { userId: user.id, date: today, leadIdentityId: identityId },
    update: { leadIdentityId: identityId },
  });

  for (const path of ["/", "/day", "/identities", "/habits", "/habits/stats", "/calendar", "/timer", "/stats"]) {
    revalidatePath(path);
  }
  return { ok: true, short: shortName(starter.name), habitCount: starter.habits.length };
}
