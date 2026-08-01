"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { FocusSession } from "@/lib/generated/prisma/client";
import {
  creditLoggedTime,
  getHabitQuota,
  toggleHabitDone,
} from "@/lib/habit-progress";
import { addLoggedSeconds, ensureOccurrence } from "@/lib/occurrences";
import { adjustSessionSeconds } from "@/lib/sessions";
import { adjustSessionSchema } from "@/lib/validation";
import {
  buildIntervalPlan,
  clampIntervals,
  clampTarget,
  type IntervalKind,
  type IntervalSpan,
  loggedElapsedSeconds,
  type TimerMode,
} from "@/lib/timer-math";

/**
 * Server-side session lifecycle.
 *
 * **The server is the authority on duration.** Every write recomputes elapsed
 * time from the row's own `runningSince`; a value reported by the client is
 * only ever used as a cross-check, never written straight through. A skewed
 * clock or a hostile POST therefore can't inflate anything on /stats.
 */

type StartInput = {
  clientKey: string;
  taskId?: string | null;
  mode: TimerMode;
  targetSeconds: number;
  intervals: number;
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

export async function startSession(
  input: StartInput,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();

  const mode = input.mode;
  // Recovery has no target. `clampTarget` would floor it at 60s, which would
  // then read back as a goal that doesn't exist.
  const targetSeconds =
    mode === "RECOVERY" ? 0 : clampTarget(input.targetSeconds);
  const intervals = mode === "POMODORO" ? clampIntervals(input.intervals) : 1;

  // Idempotent: a retry, a double submit, or a StrictMode double-effect all
  // resolve to the same row rather than two sessions.
  const existing = await prisma.focusSession.findUnique({
    where: { clientKey: input.clientKey },
  });

  if (existing) {
    if (existing.userId !== user.id) return null;
    return snapshot(existing, 0);
  }

  const task = input.taskId
    ? await prisma.task.findFirst({
        where: { id: input.taskId, userId: user.id },
        select: { id: true },
      })
    : null;

  const localDate = todayLocal(user.timezone);
  const occurrence = task
    ? await ensureOccurrence(user.id, task.id, localDate)
    : null;

  const plan = buildIntervalPlan({
    mode,
    targetSeconds,
    intervals,
    focusSeconds: user.pomodoroSeconds,
    shortBreakSeconds: user.shortBreakSeconds,
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
      shortBreakSeconds: user.shortBreakSeconds,
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

export async function pauseSession(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
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

export async function resumeSession(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  const session = await load(user.id, sessionId);
  if (!session || session.status !== "PAUSED") {
    return session ? snapshot(session, currentIndex(session)) : null;
  }

  const now = new Date();

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: { status: "RUNNING", runningSince: now, lastBeatAt: now },
  });

  await prisma.sessionInterval.updateMany({
    where: { sessionId: session.id, endedAt: null },
    data: { runningSince: now },
  });

  return snapshot(updated, currentIndex(session));
}

/**
 * Called once a minute while running. Cheap, and it means a browser crash or a
 * closed laptop loses at most 60 seconds of logged time.
 */
export async function heartbeat(
  sessionId: string,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
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
      // Stamp the moment the arc hit zero, once. A recovery session has a
      // target of 0, so without the mode guard `accumulated >= 0` would be
      // true on the very first beat and stamp a goal that never existed.
      ...(session.mode !== "RECOVERY" &&
      session.reachedTargetAt === null &&
      accumulated >= session.targetSeconds
        ? { reachedTargetAt: now }
        : {}),
    },
  });

  return snapshot(updated, currentIndex(session));
}

/** Close the current interval and open the next one in the plan. */
export async function advanceInterval(
  sessionId: string,
  nextIndex: number,
  completed: boolean,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
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
  const shouldRun = session.status === "RUNNING";

  await prisma.$transaction([
    ...closeOpenIntervalOps(session, now, completed),
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

/** Long enough for a real sentence, short enough to stay a cue, not a note. */
const MAX_RETURN_NOTE = 140;

/**
 * Record what you were in the middle of, against the break you're on.
 *
 * Written during the break rather than at the end of it, because at the end of
 * it the answer is already gone — that is the entire problem this is for.
 */
export async function setReturnNote(
  sessionId: string,
  note: string,
): Promise<void> {
  const user = await requireUser();
  const session = await load(user.id, sessionId);
  if (!session) return;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") return;

  const open = session.intervals.find((interval) => interval.endedAt === null);
  if (!open) return;

  const trimmed = note.trim().slice(0, MAX_RETURN_NOTE);

  await prisma.sessionInterval.update({
    where: { id: open.id },
    // Empty clears it. "I don't know" is a legitimate answer and should not be
    // stored as the string you happened to have typed before deleting it.
    data: { returnNote: trimmed === "" ? null : trimmed },
  });
}

/** The most anyone can add to one break in a single press, and in total. */
const MAX_EXTENSION_SECONDS = 30 * 60;
const MAX_INTERVAL_TARGET_SECONDS = 4 * 60 * 60;

/**
 * Give the interval on the clock more time, deliberately.
 *
 * This raises the interval's own `targetSeconds`, which is what makes the
 * distinction stick in the data: `closeOpenIntervalOps` measures overtime
 * against that target, so time you claimed on purpose is not logged as time
 * that got away from you. Those two things look identical on a clock and mean
 * opposite things, and /stats is unusable if it can't tell them apart.
 */
export async function extendCurrentInterval(
  sessionId: string,
  seconds: number,
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  const session = await load(user.id, sessionId);
  if (!session) return null;
  if (session.status === "COMPLETED" || session.status === "ABANDONED") {
    return snapshot(session, currentIndex(session));
  }

  const open = session.intervals.find((interval) => interval.endedAt === null);
  // Recovery's interval has no target; adding to zero would invent one.
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

export async function endSession(
  sessionId: string,
  options: { completedTask?: boolean; reason?: "TARGET_REACHED" | "USER_STOPPED" } = {},
): Promise<SessionSnapshot | null> {
  const user = await requireUser();
  const session = await load(user.id, sessionId);
  if (!session) return null;

  if (session.status === "COMPLETED") {
    return snapshot(session, currentIndex(session));
  }

  const now = new Date();
  const wallClock = serverElapsed(session, now);

  // What actually gets logged is the wall clock minus the breaks. Without this
  // a pomodoro's break minutes are credited to the task, to habit quota and to
  // the streak — see `loggedElapsedSeconds` for why it subtracts rather than
  // sums.
  const elapsed = loggedElapsedSeconds(wallClock, intervalSpans(session, now));

  // Recovery has no target to overrun. Without this guard every second of
  // rest is logged as overtime, and /stats' "time past your goal" becomes a
  // measure of how much you rested — the exact opposite of the point.
  const overtime =
    session.mode === "RECOVERY"
      ? 0
      : Math.max(0, elapsed - session.targetSeconds);
  const completedTask = options.completedTask === true;

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      status: "COMPLETED",
      endedAt: now,
      lastBeatAt: now,
      runningSince: null,
      // Stays the wall clock. It is the rehydration figure, and rewriting it to
      // the focus-only total would make a reload read as if the breaks never
      // happened.
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
  });

  // Close the open interval with its real duration rather than only stamping
  // `endedAt`. Every session ends with one interval still open, so leaving this
  // to `updateMany` left the last interval of every session reading zero — and
  // /stats' break figures are read straight off these rows.
  await prisma.$transaction([
    ...closeOpenIntervalOps(session, now, true),
    prisma.sessionInterval.updateMany({
      where: { sessionId: session.id, endedAt: null },
      data: { endedAt: now, runningSince: null },
    }),
  ]);

  if (session.occurrenceId) {
    await addLoggedSeconds(session.occurrenceId, elapsed);

    // A MINUTES habit fills its own quota from the clock — the entire point of
    // "meditate for two minutes" is that running the timer IS the bookkeeping.
    // Credited against the day's total logged time rather than this session's
    // minutes, so a retried endSession can't book the same time twice.
    if (session.taskId) {
      const occurrence = await prisma.taskOccurrence.findUnique({
        where: { id: session.occurrenceId },
        select: { loggedSeconds: true, date: true },
      });

      if (occurrence) {
        await creditLoggedTime(
          user.id,
          session.taskId,
          occurrence.date,
          occurrence.loggedSeconds,
        );
      }
    }
  }

  if (completedTask && session.taskId) {
    await completeTaskFromTimer(user.id, session.taskId, session.occurrenceId);
  }

  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/habits/stats");
  revalidatePath("/stats");

  return snapshot(updated, currentIndex(session));
}

/**
 * Start recovery from the server, without going through the client reducer.
 *
 * The close ritual's hand-off needs this: at that moment there is no provider
 * worth trusting, and the entire point of the hand-off is that you don't press
 * anything else. The redirect lands on /timer, whose layout hydrates the row
 * this just wrote.
 *
 * It ends any live work session first. Otherwise `getActiveSession` would find
 * two RUNNING rows and pick by `startedAt`. Closing the day *should* close the
 * day's work session — that's the correct behaviour, not a workaround.
 */
export async function startRecoverySession(): Promise<void> {
  const user = await requireUser();

  const existing = await prisma.focusSession.findFirst({
    where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    await endSession(existing.id, { reason: "USER_STOPPED" });
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

  revalidatePath("/timer");
  revalidatePath("/");
}

/**
 * Correct the time logged against a finished session.
 *
 * Reachable by a direct POST like every Server Function, so the input is parsed
 * and the row is re-scoped by `userId` inside `adjustSessionSeconds` — an id
 * from the client is never enough on its own.
 *
 * Revalidates the same surfaces `endSession` does, because it changes exactly
 * the same numbers: this is the same write arriving late.
 */
export async function adjustLoggedTime(input: {
  sessionId: string;
  minutes: number;
}): Promise<{ status: "ok"; loggedSeconds: number } | { status: "error"; message: string }> {
  const user = await requireUser();
  const parsed = adjustSessionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That didn't look right.",
    };
  }

  const result = await adjustSessionSeconds(
    user.id,
    parsed.data.sessionId,
    parsed.data.minutes * 60,
  );

  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "live"
          ? "That session is still running. Stop it first."
          : "That session is gone.",
    };
  }

  revalidatePath("/");
  revalidatePath("/day");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/habits/stats");
  revalidatePath("/stats");

  return { status: "ok", loggedSeconds: result.loggedSeconds };
}

/** Throw away a session that was started by mistake. */
export async function discardSession(sessionId: string): Promise<void> {
  const user = await requireUser();

  await prisma.focusSession.deleteMany({
    where: { id: sessionId, userId: user.id },
  });

  revalidatePath("/timer");
}

async function completeTaskFromTimer(
  userId: string,
  taskId: string,
  occurrenceId: string | null,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, type: true },
  });
  if (!task) return;

  if (task.type === "TODO") {
    await prisma.task.update({
      where: { id: task.id },
      data: { completedAt: new Date() },
    });
  }

  if (!occurrenceId) return;

  if (task.type === "HABIT") {
    // Through the quota, so `progress`, `tier` and `status` stay consistent.
    // Writing status: DONE directly here would leave the day counting for the
    // streak while showing tier NONE in every chart.
    const occurrence = await prisma.taskOccurrence.findUnique({
      where: { id: occurrenceId },
      select: { date: true },
    });
    const quota = occurrence ? await getHabitQuota(userId, task.id) : null;

    if (occurrence && quota) {
      await toggleHabitDone(userId, quota, occurrence.date, true);
      return;
    }
  }

  await prisma.taskOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "DONE", completedAt: new Date() },
  });
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

/**
 * Every interval's duration as of `now`, including the one still open.
 *
 * A closed interval carries its own `elapsedSeconds`; the open one has to be
 * resolved from `runningSince` the same way the session is. Feeding both into
 * one list is what lets `loggedElapsedSeconds` stay a pure function.
 */
function intervalSpans(session: LoadedSession, now: Date): IntervalSpan[] {
  return session.intervals.map((interval) => {
    if (interval.endedAt !== null) {
      return {
        kind: interval.kind as IntervalKind,
        seconds: interval.elapsedSeconds,
      };
    }

    const live = interval.runningSince
      ? Math.max(0, (now.getTime() - interval.runningSince.getTime()) / 1000)
      : 0;

    return {
      kind: interval.kind as IntervalKind,
      seconds: Math.floor(interval.accumulatedSeconds + live),
    };
  });
}

function closeOpenIntervalOps(
  session: LoadedSession,
  now: Date,
  completed: boolean,
) {
  const open = session.intervals.find((interval) => interval.endedAt === null);
  if (!open) return [];

  const live = open.runningSince
    ? Math.max(0, (now.getTime() - open.runningSince.getTime()) / 1000)
    : 0;
  const elapsed = Math.floor(open.accumulatedSeconds + live);

  // A pause closes nothing — it only freezes the clock.
  const closing = completed || elapsed >= open.targetSeconds;

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
