import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { FocusSession, User } from "@/lib/generated/prisma/client";
import {
  creditLoggedTime,
  getHabitBar,
  toggleHabitDone,
} from "@/lib/habit-progress";
import { ensureOccurrence } from "@/lib/occurrences";
import { adjustSessionSeconds } from "@/lib/sessions";
import {
  buildIntervalPlan,
  clampBreak,
  clampIntervals,
  clampTarget,
  hasIntervals,
  isBreakKind,
  nextRoundExtension,
  type IntervalKind,
  type TimerMode,
} from "@/lib/timer-math";

/**
 * Shared server-authoritative session lifecycle for both Unravel Web Server
 * Actions (Clerk cookie auth) and Desktop Companion API routes (Bearer token).
 *
 * **The server is the authority on duration.** Every write recomputes elapsed
 * time from the row's own `runningSince`; client numbers are never trusted.
 */

export type StartSessionInput = {
  clientKey: string;
  taskId?: string | null;
  mode: TimerMode;
  targetSeconds: number;
  intervals: number;
  /** Pomodoro short break, chosen on the timer. Falls back to the user default. */
  shortBreakSeconds?: number;
};

export type SessionSnapshot = {
  id: string;
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "ABANDONED";
  accumulatedSeconds: number;
  runningSince: number | null;
  intervalIndex: number;
  elapsedSeconds: number;
  overtimeSeconds: number;
  reachedTarget: boolean;
};

function snapshot(session: FocusSession, intervalIndex: number): SessionSnapshot {
  return {
    id: session.id,
    status: session.status as SessionSnapshot["status"],
    accumulatedSeconds: session.accumulatedSeconds,
    runningSince: session.runningSince?.getTime() ?? null,
    intervalIndex,
    elapsedSeconds: session.elapsedSeconds,
    overtimeSeconds: session.overtimeSeconds,
    reachedTarget: session.reachedTargetAt !== null,
  };
}

/** Active seconds the row has accrued as of `now`, computed server-side. */
function serverElapsed(session: FocusSession, now: Date): number {
  const live = session.runningSince
    ? Math.max(0, (now.getTime() - session.runningSince.getTime()) / 1000)
    : 0;
  return Math.floor(session.accumulatedSeconds + live);
}

export async function startUserSession(
  user: User,
  input: StartSessionInput,
): Promise<SessionSnapshot | null> {
  const mode = input.mode;
  const targetSeconds =
    mode === "RECOVERY" ? 0 : clampTarget(input.targetSeconds);
  const intervals = hasIntervals(mode) ? clampIntervals(input.intervals) : 1;
  const shortBreakSeconds =
    input.shortBreakSeconds === undefined
      ? user.shortBreakSeconds
      : clampBreak(input.shortBreakSeconds);

  const [existing, task] = await Promise.all([
    prisma.focusSession.findUnique({
      where: { clientKey: input.clientKey },
    }),
    input.taskId
      ? prisma.task.findFirst({
          where: { id: input.taskId, userId: user.id },
          select: { id: true },
        })
      : null,
  ]);

  if (existing) {
    if (existing.userId !== user.id) return null;
    return snapshot(existing, 0);
  }

  const localDate = todayLocal(user.timezone);
  const occurrence = task
    ? await ensureOccurrence(user.id, task.id, localDate)
    : null;

  const plan = buildIntervalPlan({
    mode,
    targetSeconds,
    intervals,
    focusSeconds: user.pomodoroSeconds,
    shortBreakSeconds,
    longBreakSeconds: user.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  });

  const now = new Date();

  const session = await prisma.focusSession.create({
    data: {
      userId: user.id,
      taskId: task?.id ?? null,
      occurrenceId: occurrence?.id ?? null,
      clientKey: input.clientKey,
      mode,
      targetSeconds,
      plannedIntervals: intervals,
      focusSeconds: user.pomodoroSeconds,
      shortBreakSeconds,
      longBreakSeconds: user.longBreakSeconds,
      status: "RUNNING",
      startedAt: now,
      runningSince: now,
      lastBeatAt: now,
      localDate,
      intervals: {
        create: {
          index: 0,
          kind: plan[0].kind,
          targetSeconds: plan[0].targetSeconds,
          startedAt: now,
          runningSince: now,
        },
      },
    },
  });

  return snapshot(session, 0);
}

export async function pauseUserSession(
  user: User,
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session || session.status !== "RUNNING") {
    return session ? snapshot(session, currentIndex(session)) : null;
  }

  const now = new Date();
  const accumulated = serverElapsed(session, now);

  const [updated] = await prisma.$transaction([
    prisma.focusSession.update({
      where: { id: session.id },
      data: {
        status: "PAUSED",
        accumulatedSeconds: accumulated,
        runningSince: null,
        lastBeatAt: now,
        pausedCount: { increment: 1 },
      },
    }),
    ...closeOpenIntervalOps(session, now, false),
  ]);

  return snapshot(updated, currentIndex(session));
}

export async function resumeUserSession(
  user: User,
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session || session.status !== "PAUSED") {
    return session ? snapshot(session, currentIndex(session)) : null;
  }

  const now = new Date();

  const [updated] = await Promise.all([
    prisma.focusSession.update({
      where: { id: session.id },
      data: { status: "RUNNING", runningSince: now, lastBeatAt: now },
    }),
    prisma.sessionInterval.updateMany({
      where: { sessionId: session.id, endedAt: null },
      data: { runningSince: now },
    }),
  ]);

  return snapshot(updated, currentIndex(session));
}

export async function heartbeatUserSession(
  user: User,
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session || session.status !== "RUNNING") return null;

  const now = new Date();
  const accumulated = serverElapsed(session, now);

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      accumulatedSeconds: accumulated,
      runningSince: now,
      lastBeatAt: now,
      ...(session.mode !== "RECOVERY" &&
      session.reachedTargetAt === null &&
      focusElapsedSeconds(session, now) >= session.targetSeconds
        ? { reachedTargetAt: now }
        : {}),
    },
  });

  return snapshot(updated, currentIndex(session));
}

export async function advanceUserInterval(
  user: User,
  sessionId: string,
  nextIndex: number,
  _completed: boolean,
  options: { resume?: boolean } = {},
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session) return null;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    return snapshot(session, currentIndex(session));
  }

  const plan = buildIntervalPlan({
    mode: session.mode,
    targetSeconds: session.targetSeconds,
    intervals: session.plannedIntervals,
    focusSeconds: session.focusSeconds,
    shortBreakSeconds: session.shortBreakSeconds,
    longBreakSeconds: session.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  });

  if (nextIndex < 0 || nextIndex >= plan.length) {
    return snapshot(session, currentIndex(session));
  }

  const now = new Date();
  const shouldRun = session.status === "RUNNING" || options.resume === true;

  await prisma.$transaction([
    ...(options.resume && session.status === "PAUSED"
      ? [
          prisma.focusSession.update({
            where: { id: session.id },
            data: { status: "RUNNING", runningSince: now, lastBeatAt: now },
          }),
        ]
      : []),
    ...closeOpenIntervalOps(session, now, true),
    prisma.sessionInterval.upsert({
      where: { sessionId_index: { sessionId: session.id, index: nextIndex } },
      create: {
        sessionId: session.id,
        index: nextIndex,
        kind: plan[nextIndex].kind,
        targetSeconds: plan[nextIndex].targetSeconds,
        startedAt: now,
        runningSince: shouldRun ? now : null,
      },
      update: { runningSince: shouldRun ? now : null },
    }),
  ]);

  const updated = await load(user.id, sessionId);
  return updated ? snapshot(updated, nextIndex) : null;
}

export async function appendUserFlowRound(
  user: User,
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session || session.mode !== "FLOW") return null;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    return snapshot(session, currentIndex(session));
  }

  const extension = nextRoundExtension({
    mode: session.mode,
    targetSeconds: session.targetSeconds,
    intervals: session.plannedIntervals,
    focusSeconds: session.focusSeconds,
    shortBreakSeconds: session.shortBreakSeconds,
    longBreakSeconds: session.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  });

  if (!extension) {
    return snapshot(session, currentIndex(session));
  }

  const nextPlan = buildIntervalPlan({
    mode: session.mode,
    targetSeconds: extension.targetSeconds,
    intervals: extension.intervals,
    focusSeconds: session.focusSeconds,
    shortBreakSeconds: session.shortBreakSeconds,
    longBreakSeconds: session.longBreakSeconds,
    longBreakEvery: user.longBreakEvery,
  });

  const nextIndex = currentIndex(session) + 1;
  const nextInterval = nextPlan[nextIndex];
  if (!nextInterval) {
    return snapshot(session, currentIndex(session));
  }

  const now = new Date();
  const accumulated = serverElapsed(session, now);

  await prisma.$transaction([
    prisma.focusSession.update({
      where: { id: session.id },
      data: {
        plannedIntervals: extension.intervals,
        targetSeconds: extension.targetSeconds,
        status: "RUNNING",
        accumulatedSeconds: accumulated,
        runningSince: now,
        lastBeatAt: now,
      },
    }),
    ...closeOpenIntervalOps(session, now, true),
    prisma.sessionInterval.upsert({
      where: { sessionId_index: { sessionId: session.id, index: nextIndex } },
      create: {
        sessionId: session.id,
        index: nextIndex,
        kind: nextInterval.kind,
        targetSeconds: nextInterval.targetSeconds,
        startedAt: now,
        runningSince: now,
      },
      update: { runningSince: now },
    }),
  ]);

  const updated = await load(user.id, sessionId);
  return updated ? snapshot(updated, nextIndex) : null;
}

const MAX_RETURN_NOTE = 140;

export async function setUserReturnNote(
  user: User,
  sessionId: string,
  note: string,
): Promise<void> {
  const session = await load(user.id, sessionId);
  if (!session) return;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") return;

  const open = session.intervals.find((interval) => interval.endedAt === null);
  if (!open) return;

  const trimmed = note.trim().slice(0, MAX_RETURN_NOTE);

  await prisma.sessionInterval.update({
    where: { id: open.id },
    data: { returnNote: trimmed === "" ? null : trimmed },
  });
}

const MAX_EXTENSION_SECONDS = 30 * 60;
const MAX_INTERVAL_TARGET_SECONDS = 4 * 60 * 60;

export async function extendUserInterval(
  user: User,
  sessionId: string,
  seconds: number,
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session) return null;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    return snapshot(session, currentIndex(session));
  }

  const open = session.intervals.find((interval) => interval.endedAt === null);
  if (!open || open.targetSeconds <= 0) {
    return snapshot(session, currentIndex(session));
  }

  const extra = Math.min(
    MAX_EXTENSION_SECONDS,
    Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0)),
  );
  if (extra === 0) return snapshot(session, currentIndex(session));

  await prisma.sessionInterval.update({
    where: { id: open.id },
    data: {
      targetSeconds: Math.min(
        MAX_INTERVAL_TARGET_SECONDS,
        open.targetSeconds + extra,
      ),
    },
  });

  return snapshot(session, currentIndex(session));
}

export async function endUserSession(
  user: User,
  sessionId: string,
  options: {
    completedTask?: boolean;
    reason?: "TARGET_REACHED" | "USER_STOPPED";
  } = {},
): Promise<SessionSnapshot | null> {
  const session = await load(user.id, sessionId);
  if (!session) return null;

  if (session.status === "COMPLETED") {
    return snapshot(session, currentIndex(session));
  }

  const now = new Date();
  const wallClock = serverElapsed(session, now);
  const elapsed = focusElapsedSeconds(session, now);
  const overtime =
    session.mode === "RECOVERY"
      ? 0
      : Math.max(0, elapsed - session.targetSeconds);
  const completedTask = options.completedTask === true;

  const [updated, , occurrence] = await Promise.all([
    prisma.focusSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        endedAt: now,
        lastBeatAt: now,
        runningSince: null,
        accumulatedSeconds: wallClock,
        elapsedSeconds: elapsed,
        overtimeSeconds: overtime,
        completedTask,
        endReason: completedTask
          ? "TASK_COMPLETED"
          : (options.reason ?? "USER_STOPPED"),
        ...(session.mode !== "RECOVERY" &&
        session.reachedTargetAt === null &&
        elapsed >= session.targetSeconds
          ? { reachedTargetAt: now }
          : {}),
      },
    }),

    prisma.$transaction([
      ...closeOpenIntervalOps(session, now, true),
      prisma.sessionInterval.updateMany({
        where: { sessionId: session.id, endedAt: null },
        data: { endedAt: now, runningSince: null },
      }),
    ]),

    !session.occurrenceId
      ? null
      : elapsed > 0
        ? prisma.taskOccurrence.update({
            where: { id: session.occurrenceId },
            data: { loggedSeconds: { increment: Math.round(elapsed) } },
            select: { loggedSeconds: true, date: true },
          })
        : prisma.taskOccurrence.findUnique({
            where: { id: session.occurrenceId },
            select: { loggedSeconds: true, date: true },
          }),
  ]);

  if (occurrence && session.taskId) {
    await creditLoggedTime(
      user.id,
      session.taskId,
      occurrence.date,
      occurrence.loggedSeconds,
    );
  }

  if (completedTask && session.taskId) {
    await completeTaskFromTimer(user.id, session.taskId, session.occurrenceId);
  }

  return snapshot(updated, currentIndex(session));
}

export async function startUserRecoverySession(user: User): Promise<void> {
  const existing = await prisma.focusSession.findFirst({
    where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await endUserSession(user, existing.id, { reason: "USER_STOPPED" });
  }

  const now = new Date();

  await prisma.focusSession.create({
    data: {
      userId: user.id,
      clientKey: randomUUID(),
      mode: "RECOVERY",
      targetSeconds: 0,
      plannedIntervals: 1,
      focusSeconds: user.pomodoroSeconds,
      shortBreakSeconds: user.shortBreakSeconds,
      longBreakSeconds: user.longBreakSeconds,
      status: "RUNNING",
      startedAt: now,
      runningSince: now,
      lastBeatAt: now,
      localDate: todayLocal(user.timezone),
      intervals: {
        create: {
          index: 0,
          kind: "RECOVERY",
          targetSeconds: 0,
          startedAt: now,
          runningSince: now,
        },
      },
    },
  });
}

export async function adjustUserLoggedTime(
  user: User,
  sessionId: string,
  minutes: number,
): Promise<
  | { status: "ok"; loggedSeconds: number }
  | { status: "error"; message: string }
> {
  const result = await adjustSessionSeconds(user.id, sessionId, minutes * 60);

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "live"
          ? "That session is still running. Stop it first."
          : "That session is gone.",
    };
  }

  return { status: "ok", loggedSeconds: result.loggedSeconds };
}

export async function discardUserSession(
  user: User,
  sessionId: string,
): Promise<void> {
  await prisma.focusSession.deleteMany({
    where: { id: sessionId, userId: user.id },
  });
}

async function completeTaskFromTimer(
  userId: string,
  taskId: string,
  occurrenceId: string | null,
) {
  const [task, occurrence, bar] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, type: true },
    }),
    occurrenceId
      ? prisma.taskOccurrence.findUnique({
          where: { id: occurrenceId },
          select: { date: true },
        })
      : null,
    getHabitBar(userId, taskId),
  ]);
  if (!task) return;

  const writes: Promise<unknown>[] = [];
  if (task.type === "TODO") {
    writes.push(
      prisma.task.update({
        where: { id: task.id },
        data: { completedAt: new Date() },
      }),
    );
  }

  if (occurrenceId) {
    if (task.type === "HABIT" && occurrence && bar) {
      writes.push(toggleHabitDone(userId, bar, occurrence.date, true));
    } else {
      writes.push(
        prisma.taskOccurrence.update({
          where: { id: occurrenceId },
          data: { status: "DONE", completedAt: new Date() },
        }),
      );
    }
  }

  await Promise.all(writes);
}

function load(userId: string, sessionId: string) {
  return prisma.focusSession.findFirst({
    where: { id: sessionId, userId },
    include: { intervals: { orderBy: { index: "asc" } } },
  });
}

type LoadedSession = NonNullable<Awaited<ReturnType<typeof load>>>;

function currentIndex(session: LoadedSession): number {
  const open = session.intervals.find((interval) => interval.endedAt === null);
  return open?.index ?? Math.max(0, session.intervals.length - 1);
}

function focusElapsedSeconds(session: LoadedSession, now: Date): number {
  const breaks = session.intervals.reduce((total, interval) => {
    if (!isBreakKind(interval.kind as IntervalKind)) return total;

    if (interval.endedAt !== null) {
      return total + interval.elapsedSeconds;
    }

    const live = interval.runningSince
      ? Math.max(0, (now.getTime() - interval.runningSince.getTime()) / 1000)
      : 0;

    return total + Math.floor(interval.accumulatedSeconds + live);
  }, 0);

  return Math.max(0, serverElapsed(session, now) - breaks);
}

function closeOpenIntervalOps(
  session: LoadedSession,
  now: Date,
  closing: boolean,
) {
  const open = session.intervals.find((interval) => interval.endedAt === null);
  if (!open) return [];

  const live = open.runningSince
    ? Math.max(0, (now.getTime() - open.runningSince.getTime()) / 1000)
    : 0;
  const elapsed = Math.floor(open.accumulatedSeconds + live);

  return [
    prisma.sessionInterval.update({
      where: { id: open.id },
      data: {
        accumulatedSeconds: elapsed,
        runningSince: null,
        ...(closing
          ? {
              endedAt: now,
              elapsedSeconds: elapsed,
              overtimeSeconds: Math.max(0, elapsed - open.targetSeconds),
              completed: elapsed >= open.targetSeconds,
            }
          : {}),
      },
    }),
  ];
}
