import "server-only";

import { allBeatsDone, beatCount, beatIndexAt } from "@/lib/block-beats";
import { prisma } from "@/lib/db";
import { minuteOfDayLocal, todayLocal } from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";

/**
 * A plain module rather than exports from a `"use server"` file, for the same
 * reason as `lib/step-sync.ts`: these take a `userId`, and as endpoints they
 * would let anyone tick anyone's calendar.
 */

/**
 * Keep the block's own tick agreeing with what's inside it.
 *
 * Two rules, one per kind of block:
 *
 * - A **beat block** is done exactly when every interval is. Its task lines
 *   still tick, but they are the things you did *in* an interval — finishing
 *   one habit at 10:05 does not mean the hour is over.
 * - Any other block with tasks is done exactly when all of them are ticked.
 *   Ticking the last one closes the block; un-ticking one reopens it.
 *
 * A plain block with no tasks is left alone — its tick is the only thing that
 * can speak for it, and "lunch" has no lines to tally.
 */
export async function reconcileBlockCompletion(
  userId: string,
  blockId: string,
): Promise<void> {
  const block = await prisma.timeBlock.findFirst({
    where: { id: blockId, userId },
    select: {
      completedAt: true,
      startMinute: true,
      endMinute: true,
      beatMinutes: true,
      tasks: { select: { doneAt: true } },
      beats: { select: { index: true } },
    },
  });

  if (!block) return;

  let allDone: boolean;
  if (block.beatMinutes) {
    allDone = allBeatsDone(block.beats, beatCount(block, block.beatMinutes));
  } else {
    if (block.tasks.length === 0) return;
    allDone = block.tasks.every((link) => link.doneAt !== null);
  }

  if (allDone === (block.completedAt !== null)) return;

  await prisma.timeBlock.update({
    where: { id: blockId },
    data: { completedAt: allDone ? new Date() : null },
  });
}

/**
 * A whole task or habit was just ticked in a block: if an interval is open on
 * it, that interval got its one thing. Steps never come through here.
 *
 * "Open" means today, in the user's own zone, with the current minute inside
 * the block.
 *
 * `update: {}` keeps the first tick of an interval as its label: the interval
 * was earned by that one, and a second tick in the same window is just more.
 * Un-ticking never un-earns the interval — the thing was still done. Tapping
 * the interval itself is how to take it back.
 */
export async function markCurrentBeat(
  user: Pick<User, "id" | "timezone">,
  target: { blockId: string; label: string | null },
): Promise<void> {
  const minute = minuteOfDayLocal(user.timezone);

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: todayLocal(user.timezone),
      beatMinutes: { not: null },
      startMinute: { lte: minute },
      endMinute: { gt: minute },
      id: target.blockId,
    },
    select: { id: true, startMinute: true, endMinute: true, beatMinutes: true },
  });

  for (const block of blocks) {
    const index = beatIndexAt(block, block.beatMinutes ?? 0, minute);
    if (index === null) continue;

    await prisma.timeBlockBeat.upsert({
      where: { blockId_index: { blockId: block.id, index } },
      update: {},
      create: { blockId: block.id, index, label: target.label?.slice(0, 200) ?? null },
    });

    await reconcileBlockCompletion(user.id, block.id);
  }
}
