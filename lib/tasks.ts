/**
 * Shared reads over tasks, habits and their occurrences.
 *
 * The habit half of this file is where the sparse-occurrence model earns its
 * keep: "which habits are due today" is answered by evaluating recurrence rules
 * in memory over the user's handful of habits, then joining only the occurrence
 * rows that actually exist. Nothing is pre-generated for future days.
 */

import { prisma } from "@/lib/db";
import { addDays, toISODate, todayLocal } from "@/lib/dates";
import type {
  OccurrenceStatus,
  Priority,
  TaskOccurrence,
  TimerMode,
  User,
} from "@/lib/generated/prisma/client";
import { anchorTitleOf } from "@/lib/habit-cue";
import type { HabitUnit, Quota, QuotaTier } from "@/lib/quota";
import {
  isDueOn,
  wasMissedOn,
  type RecurrenceRule,
} from "@/lib/recurrence";
import type { StepLike } from "@/lib/steps";
import { MAX_MANUAL_LOG_MINUTES } from "@/lib/timer-math";

export type TaskSummary = {
  id: string;
  type: "TODO" | "HABIT";
  title: string;
  notes: string | null;
  priority: Priority;
  estimatedSeconds: number | null;
  defaultMode: TimerMode;
  plannedIntervals: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  project: { id: string; name: string; color: string } | null;
  /** Ordered. Empty for a task nobody broke down, which is most of them. */
  steps: StepLike[];
};

export type TodayItem = TaskSummary & {
  /** For habits, today's instance. For todos, the day's engagement row. */
  occurrenceStatus: OccurrenceStatus | null;
  loggedSeconds: number;
  done: boolean;
  /**
   * The floor for the "how long did that take" dialog, in minutes. For a
   * MINUTES habit it is the habit's own minimum; for everything else it is
   * one — time is not the thing a COUNT habit is counted in.
   */
  minimumMinutes: number;
  /** Negative = overdue by N days. Null for habits and undated todos. */
  daysUntilDue: number | null;
  recurrenceDays: number[] | null;
  /** Habits only: the thing this one is stacked on. */
  cue: CueSummary | null;
  /**
   * Habits only: the habit was due yesterday and has no DONE behind it. A
   * deliberate skip or a day the habit isn't scheduled for is not a miss — the
   * marker exists to stop two missed days in a row, not to tally them.
   */
  missedYesterday: boolean;
};

/**
 * A habit's cue, with the anchor's title already resolved whichever kind it is —
 * so no surface has to know that a habit anchor's name lives on another row
 * while a label anchor's name lives on this one.
 */
export type CueSummary = {
  anchorTaskId: string | null;
  anchorLabel: string | null;
  anchorMinutes: number;
  anchorTitle: string | null;
};

/**
 * Joined rather than resolved in memory against the habits already fetched: an
 * anchor can be archived, and an archived habit is still a perfectly good cue —
 * "after my morning walk" doesn't stop being a trigger because you stopped
 * counting the walks.
 */
const cueSelect = {
  select: {
    anchorTaskId: true,
    anchorLabel: true,
    anchorMinutes: true,
    anchorTask: { select: { title: true } },
  },
} as const;

type CueRow = {
  anchorTaskId: string | null;
  anchorLabel: string | null;
  anchorMinutes: number;
  anchorTask: { title: string } | null;
};

const toCue = (row: CueRow | null): CueSummary | null =>
  row
    ? {
        anchorTaskId: row.anchorTaskId,
        anchorLabel: row.anchorLabel,
        anchorMinutes: row.anchorMinutes,
        anchorTitle: anchorTitleOf(row, row.anchorTask?.title),
      }
    : null;

const taskSelect = {
  id: true,
  type: true,
  title: true,
  notes: true,
  priority: true,
  color: true,
  estimatedSeconds: true,
  defaultMode: true,
  plannedIntervals: true,
  dueDate: true,
  completedAt: true,
  sortOrder: true,
  project: { select: { id: true, name: true, color: true } },
  // Always fetched with the task. A task's steps are a handful of tiny rows and
  // every surface that renders a task wants at least the next one — making it
  // conditional would mean two shapes of TaskSummary and a lot of `?.`.
  steps: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      position: true,
      estimatedSeconds: true,
      completedAt: true,
    },
  },
} as const;

const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function byPriorityThenOrder(
  a: { priority: Priority; sortOrder: number },
  b: { priority: Priority; sortOrder: number },
) {
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  return priority !== 0 ? priority : a.sortOrder - b.sortOrder;
}

// ---------------------------------------------------------------- today

export type TodayView = {
  date: Date;
  habits: TodayItem[];
  overdue: TodayItem[];
  dueToday: TodayItem[];
  undated: TodayItem[];
  completedToday: TodayItem[];
  plannedSeconds: number;
  loggedSeconds: number;
};

export async function getTodayView(user: User): Promise<TodayView> {
  const today = todayLocal(user.timezone);
  const yesterday = addDays(today, -1);

  const [habitTasks, todoTasks, occurrences] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, type: "HABIT", archivedAt: null },
      select: { ...taskSelect, recurrence: true, cue: cueSelect },
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        type: "TODO",
        archivedAt: null,
        OR: [
          { completedAt: null },
          // Keep today's finished todos visible — crossing things off is the
          // point, and an empty list reads as "you did nothing".
          { completedAt: { gte: today } },
        ],
      },
      select: taskSelect,
    }),
    // Yesterday rides along with today so the "missed yesterday" marker never
    // needs a second query — a habit's history for one extra day is a few rows.
    prisma.taskOccurrence.findMany({
      where: { userId: user.id, date: { in: [yesterday, today] } },
    }),
  ]);

  // A habit is only *done* by today's occurrence — yesterday's DONE row
  // belongs to yesterday and must not tick today's box.
  const todayISO = toISODate(today);
  const occurrenceByTask = new Map<string, TaskOccurrence>(
    occurrences
      .filter((occurrence) => toISODate(occurrence.date) === todayISO)
      .map((occurrence) => [occurrence.taskId, occurrence]),
  );

  const yesterdayISO = toISODate(yesterday);
  const yesterdayStatus = new Map<string, "DONE" | "SKIPPED">();
  for (const occurrence of occurrences) {
    if (toISODate(occurrence.date) !== yesterdayISO) continue;
    if (occurrence.status === "DONE" || occurrence.status === "SKIPPED") {
      yesterdayStatus.set(occurrence.taskId, occurrence.status);
    }
  }
  const completionsForYesterday = (
    taskId: string,
  ): Map<string, "DONE" | "SKIPPED"> => {
    const status = yesterdayStatus.get(taskId);
    return status ? new Map([[yesterdayISO, status]]) : new Map();
  };

  const habits: TodayItem[] = habitTasks
    .filter((task) => {
      if (!task.recurrence) return false;
      return isDueOn(toRule(task.recurrence), today);
    })
    .sort(byPriorityThenOrder)
    .map((task) => {
      const occurrence = occurrenceByTask.get(task.id);
      return {
        ...toSummary(task),
        occurrenceStatus: occurrence?.status ?? null,
        loggedSeconds: occurrence?.loggedSeconds ?? 0,
        done: occurrence?.status === "DONE",
        minimumMinutes:
          task.recurrence?.unit === "MINUTES"
            ? Math.min(task.recurrence.minimumQuota, MAX_MANUAL_LOG_MINUTES)
            : 1,
        daysUntilDue: null,
        recurrenceDays: task.recurrence?.daysOfWeek ?? null,
        cue: toCue(task.cue),
        missedYesterday: wasMissedOn(
          toRule(task.recurrence!),
          completionsForYesterday(task.id),
          yesterday,
        ),
      };
    });

  const todos: TodayItem[] = todoTasks.sort(byPriorityThenOrder).map((task) => {
    const occurrence = occurrenceByTask.get(task.id);
    return {
      ...toSummary(task),
      occurrenceStatus: occurrence?.status ?? null,
      loggedSeconds: occurrence?.loggedSeconds ?? 0,
      done: task.completedAt !== null,
      minimumMinutes: 1,
      daysUntilDue: task.dueDate
        ? Math.round(
            (task.dueDate.getTime() - today.getTime()) / 86_400_000,
          )
        : null,
      recurrenceDays: null,
      cue: null,
      missedYesterday: false,
    };
  });

  const open = todos.filter((task) => !task.done);

  const view: TodayView = {
    date: today,
    habits: habits.filter((habit) => !habit.done),
    overdue: open.filter(
      (task) => task.daysUntilDue !== null && task.daysUntilDue < 0,
    ),
    dueToday: open.filter((task) => task.daysUntilDue === 0),
    undated: open.filter((task) => task.daysUntilDue === null),
    completedToday: [
      ...habits.filter((habit) => habit.done),
      ...todos.filter((task) => task.done),
    ],
    plannedSeconds: 0,
    loggedSeconds: 0,
  };

  const upNext = [
    ...view.habits,
    ...view.overdue,
    ...view.dueToday,
    ...view.undated,
  ];

  view.plannedSeconds = upNext.reduce(
    (sum, item) => sum + (item.estimatedSeconds ?? 0),
    0,
  );
  view.loggedSeconds = occurrences
    .filter((occurrence) => toISODate(occurrence.date) === todayISO)
    .reduce((sum, occurrence) => sum + occurrence.loggedSeconds, 0);

  return view;
}

// ---------------------------------------------------------------- habits page

export type HabitWithHistory = TaskSummary & {
  rule: RecurrenceRule;
  daysOfWeek: number[];
  /** ISO date -> status, for the adherence grid and streak walk. */
  history: Map<string, "DONE" | "SKIPPED">;
  /**
   * ISO date -> tier, parallel to `history`. Kept separate rather than folded
   * into it so `computeStreak` stays quota-unaware: the streak only ever asks
   * "was this DONE", and DONE already means "the minimum was met".
   */
  tiers: Map<string, QuotaTier>;
  quota: Quota;
  /** Progress on `today`, in the habit's own unit. */
  todayProgress: number;
  archivedAt: Date | null;
  /** The thing this habit is stacked on, if any. */
  cue: CueSummary | null;
};

export async function getHabits(
  user: User,
  historyDays = 56,
): Promise<HabitWithHistory[]> {
  const today = todayLocal(user.timezone);
  const from = addDays(today, -historyDays);

  const [habits, occurrences] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, type: "HABIT" },
      select: {
        ...taskSelect,
        archivedAt: true,
        recurrence: true,
        cue: cueSelect,
      },
      orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.taskOccurrence.findMany({
      where: { userId: user.id, date: { gte: from, lte: today } },
      select: {
        taskId: true,
        date: true,
        status: true,
        tier: true,
        progress: true,
      },
    }),
  ]);

  const historyByTask = new Map<string, Map<string, "DONE" | "SKIPPED">>();
  const tiersByTask = new Map<string, Map<string, QuotaTier>>();
  const todayProgress = new Map<string, number>();
  const todayISO = toISODate(today);

  for (const occurrence of occurrences) {
    const iso = toISODate(occurrence.date);

    if (occurrence.status === "DONE" || occurrence.status === "SKIPPED") {
      const map = historyByTask.get(occurrence.taskId) ?? new Map();
      map.set(iso, occurrence.status);
      historyByTask.set(occurrence.taskId, map);
    }

    const tiers = tiersByTask.get(occurrence.taskId) ?? new Map();
    tiers.set(iso, occurrence.tier);
    tiersByTask.set(occurrence.taskId, tiers);

    if (iso === todayISO) {
      todayProgress.set(occurrence.taskId, occurrence.progress);
    }
  }

  return habits
    .filter((habit) => habit.recurrence !== null)
    .map((habit) => ({
      ...toSummary(habit),
      archivedAt: habit.archivedAt,
      rule: toRule(habit.recurrence!),
      daysOfWeek: habit.recurrence!.daysOfWeek,
      history: historyByTask.get(habit.id) ?? new Map(),
      tiers: tiersByTask.get(habit.id) ?? new Map(),
      quota: {
        unit: habit.recurrence!.unit as HabitUnit,
        minimum: habit.recurrence!.minimumQuota,
        optimal: habit.recurrence!.optimalQuota,
      },
      todayProgress: todayProgress.get(habit.id) ?? 0,
      cue: toCue(habit.cue),
    }));
}

// ---------------------------------------------------------------- all tasks

export type TaskFilter = "open" | "done" | "all";

export async function getTasks(
  user: User,
  filter: TaskFilter = "open",
): Promise<TaskSummary[]> {
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      type: "TODO",
      archivedAt: null,
      ...(filter === "open" ? { completedAt: null } : {}),
      ...(filter === "done" ? { NOT: { completedAt: null } } : {}),
    },
    select: taskSelect,
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }],
  });

  return tasks.map(toSummary);
}

export async function getProjects(user: User) {
  return prisma.project.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });
}

/** A single task, always scoped by user — never trust an id off the wire. */
export async function getTask(user: User, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    include: {
      project: { select: { id: true, name: true, color: true } },
      recurrence: true,
      cue: true,
      steps: { orderBy: { position: "asc" } },
    },
  });
}

/**
 * The habits a habit can be stacked on.
 *
 * Archived habits are excluded: offering one as a new anchor would be offering a
 * trigger that has already stopped happening. `exceptId` drops the habit being
 * edited, so the form can't propose the most obvious cycle.
 */
export async function getAnchorHabits(
  user: User,
  exceptId?: string,
): Promise<{ id: string; title: string }[]> {
  return prisma.task.findMany({
    where: {
      userId: user.id,
      type: "HABIT",
      archivedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true },
  });
}

// ---------------------------------------------------------------- helpers

function toRule(recurrence: {
  daysOfWeek: number[];
  startDate: Date;
  endDate: Date | null;
}): RecurrenceRule {
  return {
    daysOfWeek: recurrence.daysOfWeek,
    startDate: recurrence.startDate,
    endDate: recurrence.endDate,
  };
}

/** Narrow a Prisma row to the shape the UI actually renders. */
function toSummary(task: {
  id: string;
  type: "TODO" | "HABIT";
  title: string;
  notes: string | null;
  priority: Priority;
  estimatedSeconds: number | null;
  defaultMode: TimerMode;
  plannedIntervals: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  project: { id: string; name: string; color: string } | null;
  steps: StepLike[];
}): TaskSummary {
  return {
    id: task.id,
    type: task.type,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    estimatedSeconds: task.estimatedSeconds,
    defaultMode: task.defaultMode,
    plannedIntervals: task.plannedIntervals,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    project: task.project,
    steps: task.steps,
  };
}
