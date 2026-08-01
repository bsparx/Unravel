import "server-only";

import { balanceRatio, describeBalance, recoveryShare } from "@/lib/balance";
import { summariseBreaks } from "@/lib/break-stats";
import { prisma } from "@/lib/db";
import { addDays, startOfWeek, toISODate, todayLocal } from "@/lib/dates";
import type { TimerMode, User } from "@/lib/generated/prisma/client";
import { computeStreak, expectedDatesBetween } from "@/lib/recurrence";

/**
 * Every number on /stats.
 *
 * All of it is `groupBy`/`aggregate` — no `$queryRaw` anywhere. That's only
 * possible because `FocusSession.localDate` and `TaskOccurrence.date` are
 * pre-bucketed DATE columns; Prisma can't bucket a timestamp by day, so the
 * denormalization is what keeps this file boring.
 *
 * The two things computed in JS instead — habit adherence denominators and
 * time-of-day — are computed there because the data genuinely isn't in a table,
 * not because the query was awkward.
 */

export type StatsRange = "week" | "month" | "quarter";

export const RANGE_DAYS: Record<StatsRange, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

export type StatsData = Awaited<ReturnType<typeof getStats>>;

export async function getStats(user: User, range: StatsRange) {
  const today = todayLocal(user.timezone);
  const days = RANGE_DAYS[range];
  const from = addDays(today, -(days - 1));
  const weekStart = startOfWeek(today, user.weekStart);

  const scope = {
    userId: user.id,
    status: "COMPLETED" as const,
    localDate: { gte: from, lte: today },
  };

  // The headline numbers are work-only. Folding rest into "last 30 days"
  // silently would make the headline argue with the balance panel below it.
  const workOnly = { mode: { not: "RECOVERY" as const } };

  const [
    totals,
    recoveryTotals,
    todayTotals,
    weekTotals,
    byDayMode,
    byTask,
    byMode,
    completionsByDay,
    sessionTimes,
    intervalCounts,
    breakIntervals,
  ] = await Promise.all([
    prisma.focusSession.aggregate({
      where: { ...scope, ...workOnly },
      _sum: { elapsedSeconds: true, overtimeSeconds: true, plannedIntervals: true },
      _avg: { pausedCount: true },
      _count: { _all: true },
    }),

    prisma.focusSession.aggregate({
      where: { ...scope, mode: "RECOVERY" },
      _sum: { elapsedSeconds: true },
      _count: { _all: true },
    }),

    prisma.focusSession.aggregate({
      where: {
        userId: user.id,
        status: "COMPLETED",
        localDate: today,
        ...workOnly,
      },
      _sum: { elapsedSeconds: true },
      _count: { _all: true },
    }),

    prisma.focusSession.aggregate({
      where: {
        userId: user.id,
        status: "COMPLETED",
        localDate: { gte: weekStart, lte: today },
        ...workOnly,
      },
      _sum: { elapsedSeconds: true },
    }),

    // The heatmap and the balance series in one pass. Grouping by mode as well
    // as date is a superset of the old per-day query — summing across modes
    // reproduces it exactly — so this costs no extra round trip.
    prisma.focusSession.groupBy({
      by: ["localDate", "mode"],
      where: scope,
      _sum: { elapsedSeconds: true },
      orderBy: { localDate: "asc" },
    }),

    prisma.focusSession.groupBy({
      by: ["taskId"],
      where: { ...scope, NOT: { taskId: null } },
      _sum: { elapsedSeconds: true },
      _count: { _all: true },
      orderBy: { _sum: { elapsedSeconds: "desc" } },
      take: 25,
    }),

    prisma.focusSession.groupBy({
      by: ["mode"],
      where: scope,
      _sum: { elapsedSeconds: true },
      _count: { _all: true },
    }),

    prisma.taskOccurrence.groupBy({
      by: ["date"],
      where: {
        userId: user.id,
        status: "DONE",
        date: { gte: from, lte: today },
      },
      _count: { _all: true },
      orderBy: { date: "asc" },
    }),

    // Hour-of-day has to be bucketed in JS: Prisma can't EXTRACT(hour), and at
    // this row count it isn't worth another denormalized column.
    prisma.focusSession.findMany({
      where: scope,
      select: { startedAt: true, elapsedSeconds: true },
    }),

    prisma.sessionInterval.count({
      where: {
        kind: "FOCUS",
        completed: true,
        session: scope,
      },
    }),

    // Breaks, which were unmeasurable until they stopped pausing at their own
    // boundary. The session's snapshotted settings give what each break was
    // originally going to be, so a deliberate extension stays separable from an
    // overrun without another column.
    prisma.sessionInterval.findMany({
      where: {
        kind: { in: ["SHORT_BREAK", "LONG_BREAK"] },
        endedAt: { not: null },
        session: scope,
      },
      select: {
        kind: true,
        targetSeconds: true,
        elapsedSeconds: true,
        overtimeSeconds: true,
        session: {
          select: { shortBreakSeconds: true, longBreakSeconds: true },
        },
      },
    }),
  ]);

  const breaks = summariseBreaks(
    breakIntervals.map((interval) => ({
      plannedSeconds:
        interval.kind === "LONG_BREAK"
          ? interval.session.longBreakSeconds
          : interval.session.shortBreakSeconds,
      targetSeconds: interval.targetSeconds,
      elapsedSeconds: interval.elapsedSeconds,
      overtimeSeconds: interval.overtimeSeconds,
    })),
  );

  // ---- hydrate task names for the "where did the time go" table ------------

  const taskIds = byTask
    .map((row) => row.taskId)
    .filter((id): id is string => id !== null);

  const tasks = taskIds.length
    ? await prisma.task.findMany({
        where: { id: { in: taskIds }, userId: user.id },
        select: {
          id: true,
          title: true,
          type: true,
          estimatedSeconds: true,
          project: { select: { id: true, name: true } },
        },
      })
    : [];

  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const timeByTask = byTask
    .map((row) => {
      const task = row.taskId ? taskById.get(row.taskId) : undefined;
      if (!task) return null;
      return {
        id: task.id,
        title: task.title,
        type: task.type,
        project: task.project,
        estimatedSeconds: task.estimatedSeconds,
        seconds: row._sum.elapsedSeconds ?? 0,
        sessions: row._count._all,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  // Folded into projects in JS rather than denormalizing projectId onto every
  // session, which would then need keeping in sync when a task moves list.
  const projectTotals = new Map<string, { name: string; seconds: number }>();
  for (const row of timeByTask) {
    const key = row.project?.id ?? "none";
    const entry = projectTotals.get(key) ?? {
      name: row.project?.name ?? "No list",
      seconds: 0,
    };
    entry.seconds += row.seconds;
    projectTotals.set(key, entry);
  }

  // ---- estimate accuracy --------------------------------------------------

  const estimated = timeByTask.filter(
    (row) => row.estimatedSeconds && row.estimatedSeconds > 0,
  );

  const ratios = estimated
    .map((row) => row.seconds / row.estimatedSeconds!)
    .sort((a, b) => a - b);

  const medianRatio =
    ratios.length > 0
      ? ratios.length % 2 === 1
        ? ratios[(ratios.length - 1) / 2]
        : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2
      : null;

  const worstUnderestimates = [...estimated]
    .map((row) => ({
      ...row,
      estimatedSeconds: row.estimatedSeconds!,
      overBy: row.seconds - row.estimatedSeconds!,
    }))
    .filter((row) => row.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy)
    .slice(0, 5);

  // ---- habits -------------------------------------------------------------

  const habits = await prisma.task.findMany({
    where: { userId: user.id, type: "HABIT", archivedAt: null },
    select: { id: true, title: true, recurrence: true },
  });

  const habitOccurrences = habits.length
    ? await prisma.taskOccurrence.findMany({
        where: {
          userId: user.id,
          taskId: { in: habits.map((habit) => habit.id) },
          status: { in: ["DONE", "SKIPPED"] },
        },
        select: { taskId: true, date: true, status: true },
        orderBy: { date: "asc" },
      })
    : [];

  const historyByHabit = new Map<string, Map<string, "DONE" | "SKIPPED">>();
  for (const occurrence of habitOccurrences) {
    const map = historyByHabit.get(occurrence.taskId) ?? new Map();
    map.set(toISODate(occurrence.date), occurrence.status as "DONE" | "SKIPPED");
    historyByHabit.set(occurrence.taskId, map);
  }

  const habitAdherence = habits
    .filter((habit) => habit.recurrence !== null)
    .map((habit) => {
      const rule = {
        daysOfWeek: habit.recurrence!.daysOfWeek,
        startDate: habit.recurrence!.startDate,
        endDate: habit.recurrence!.endDate,
      };
      const history = historyByHabit.get(habit.id) ?? new Map();

      // Expected days are not rows — they can only be computed.
      const expected = expectedDatesBetween(rule, from, today);
      const done = expected.filter(
        (date) => history.get(toISODate(date)) === "DONE",
      ).length;

      return {
        id: habit.id,
        title: habit.title,
        expected: expected.length,
        done,
        adherence:
          expected.length > 0 ? Math.round((done / expected.length) * 100) : 0,
        streak: computeStreak(rule, history, today),
      };
    })
    .sort((a, b) => b.adherence - a.adherence);

  // ---- time of day --------------------------------------------------------

  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: user.timezone,
    hour: "2-digit",
    hour12: false,
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: 0,
  }));

  for (const session of sessionTimes) {
    const hour = Number(hourFormatter.format(session.startedAt));
    if (Number.isFinite(hour) && hour >= 0 && hour < 24) {
      byHour[hour].seconds += session.elapsedSeconds;
    }
  }

  // ---- daily series (dense, so the heatmap has no gaps) -------------------

  const workByDate = new Map<string, number>();
  const restByDate = new Map<string, number>();

  for (const row of byDayMode) {
    const iso = toISODate(row.localDate);
    const seconds = row._sum.elapsedSeconds ?? 0;
    const bucket = row.mode === "RECOVERY" ? restByDate : workByDate;
    bucket.set(iso, (bucket.get(iso) ?? 0) + seconds);
  }

  const completionsByDate = new Map(
    completionsByDay.map((row) => [toISODate(row.date), row._count._all]),
  );

  const daily = Array.from({ length: days }, (_, offset) => {
    const date = addDays(from, offset);
    const iso = toISODate(date);
    const workSeconds = workByDate.get(iso) ?? 0;
    const recoverySeconds = restByDate.get(iso) ?? 0;

    return {
      date,
      iso,
      workSeconds,
      recoverySeconds,
      // The heatmap is about focus, so `seconds` stays work-only and that
      // component needs no change.
      seconds: workSeconds,
      completions: completionsByDate.get(iso) ?? 0,
    };
  });

  const workSeconds = totals._sum.elapsedSeconds ?? 0;
  const recoverySeconds = recoveryTotals._sum.elapsedSeconds ?? 0;

  return {
    range,
    days,
    from,
    today,
    totals: {
      seconds: workSeconds,
      overtimeSeconds: totals._sum.overtimeSeconds ?? 0,
      sessions: totals._count._all,
      avgPauses: totals._avg.pausedCount ?? 0,
      plannedIntervals: totals._sum.plannedIntervals ?? 0,
      completedIntervals: intervalCounts,
    },
    balance: {
      workSeconds,
      recoverySeconds,
      recoverySessions: recoveryTotals._count._all,
      share: recoveryShare(workSeconds, recoverySeconds),
      ratio: balanceRatio(workSeconds, recoverySeconds),
      sentence: describeBalance(workSeconds, recoverySeconds),
      /** Days you worked and logged no rest at all — the number that actually
       *  changes behaviour. */
      daysWithNoRecovery: daily.filter(
        (day) => day.workSeconds > 0 && day.recoverySeconds === 0,
      ).length,
    },
    breaks,
    todaySeconds: todayTotals._sum.elapsedSeconds ?? 0,
    todaySessions: todayTotals._count._all,
    weekSeconds: weekTotals._sum.elapsedSeconds ?? 0,
    daily,
    timeByTask: timeByTask.slice(0, 8),
    timeByProject: [...projectTotals.values()].sort(
      (a, b) => b.seconds - a.seconds,
    ),
    byMode: byMode.map((row) => ({
      mode: row.mode as TimerMode,
      seconds: row._sum.elapsedSeconds ?? 0,
      sessions: row._count._all,
    })),
    estimateAccuracy: {
      medianRatio,
      sampleSize: estimated.length,
      worstUnderestimates,
    },
    habitAdherence,
    byHour,
  };
}
