import "server-only";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import { buildIntervalPlan, type TimerConfig } from "@/lib/timer-math";

/** A session left RUNNING this long with no heartbeat was never closed. */
const REAP_AFTER_MS = 12 * 60 * 60 * 1000;

export type HydratedSession = {
  id: string;
  clientKey: string;
  status: "RUNNING" | "PAUSED";
  accumulatedSeconds: number;
  /** Epoch ms of the server's last resume, or null while paused. */
  runningSince: number | null;
  intervalIndex: number;
  intervalBaseSeconds: number;
  /** Seconds added to the open interval by hand, recovered from its target. */
  intervalExtraSeconds: number;
  /** What the open interval says you were in the middle of, if anything. */
  returnNote: string | null;
  reachedTarget: boolean;
  config: TimerConfig;
  task: { id: string; title: string; type: "TODO" | "HABIT" } | null;
};

/**
 * The live session, if there is one.
 *
 * Also reaps stale rows lazily: a session whose tab died without a `pagehide`
 * beacon is marked ABANDONED the next time anyone looks, which is why this app
 * needs no cron job.
 */
export async function getActiveSession(
  user: User,
): Promise<HydratedSession | null> {
  const session = await prisma.focusSession.findFirst({
    where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    include: {
      intervals: { orderBy: { index: "asc" } },
      task: { select: { id: true, title: true, type: true } },
    },
  });

  if (!session) return null;

  const staleSince = Date.now() - session.lastBeatAt.getTime();
  if (staleSince > REAP_AFTER_MS) {
    await prisma.focusSession.update({
      where: { id: session.id },
      data: {
        status: "ABANDONED",
        endReason: "ABANDONED",
        endedAt: session.lastBeatAt,
        runningSince: null,
        elapsedSeconds: session.accumulatedSeconds,
      },
    });
    return null;
  }

  const openInterval =
    session.intervals.find((interval) => interval.endedAt === null) ??
    session.intervals.at(-1);

  const intervalBaseSeconds = session.intervals
    .filter((interval) => interval.index < (openInterval?.index ?? 0))
    .reduce((sum, interval) => sum + interval.elapsedSeconds, 0);

  const config: TimerConfig = {
    mode: session.mode,
    targetSeconds: session.targetSeconds,
    intervals: session.plannedIntervals,
    focusSeconds: session.focusSeconds,
    shortBreakSeconds: session.shortBreakSeconds,
    longBreakSeconds: session.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  };

  // A "5 more minutes" is stored by raising the interval's own target, so the
  // extension is recoverable as the difference from what the plan asked for.
  // Deriving it beats a column: there is then only one place that decides what
  // this break is aiming at, and a reload cannot disagree with the clock.
  const planned = buildIntervalPlan(config)[openInterval?.index ?? 0];
  const intervalExtraSeconds =
    openInterval && planned
      ? Math.max(0, openInterval.targetSeconds - planned.targetSeconds)
      : 0;

  return {
    id: session.id,
    clientKey: session.clientKey,
    status: session.status as "RUNNING" | "PAUSED",
    accumulatedSeconds: session.accumulatedSeconds,
    runningSince: session.runningSince?.getTime() ?? null,
    intervalIndex: openInterval?.index ?? 0,
    intervalBaseSeconds,
    intervalExtraSeconds,
    returnNote: openInterval?.returnNote ?? null,
    reachedTarget: session.reachedTargetAt !== null,
    config,
    task: session.task,
  };
}
