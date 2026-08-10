/**
 * Reads over the calendar. The arithmetic lives in `lib/block-math.ts`; this
 * file only fetches and shapes.
 *
 * A block is a *plan*; a FocusSession is what *happened*. They are joined here
 * for display but never merged in the database — the gap between the two is
 * the most useful thing the calendar can show you, and it disappears the
 * moment planning starts writing to the log.
 */

import { prisma } from "@/lib/db";
import { addDays, toISODate } from "@/lib/dates";
import type { BlockKind, User } from "@/lib/generated/prisma/client";
import { claimedMinutes, type Span } from "@/lib/block-math";
import { anchorTitleOf } from "@/lib/habit-cue";
import { isDueOn, wasMissedOn } from "@/lib/recurrence";

export type CalendarBlock = {
  id: string;
  title: string;
  notes: string | null;
  dateISO: string;
  startMinute: number;
  endMinute: number;
  kind: BlockKind;
  completedAt: Date | null;
  /**
   * Set when this block is the cue sitting immediately before another one. The
   * grid renders it as part of that block rather than as a peer, and it is the
   * only block with an "drop it for today" affordance.
   */
  cueForId: string | null;
  /** This block has a cue in front of it — so moving it has to move two things. */
  hasCue: boolean;
  task: {
    id: string;
    title: string;
    /** The calendar hue this task wears; blocks inherit it. */
    color: string;
    estimatedSeconds: number | null;
    defaultMode: "POMODORO" | "BASIC" | "FLOW" | "RECOVERY";
    plannedIntervals: number | null;
    completedAt: Date | null;
  } | null;
};

const blockSelect = {
  id: true,
  title: true,
  notes: true,
  date: true,
  startMinute: true,
  endMinute: true,
  kind: true,
  completedAt: true,
  cueForId: true,
  cue: { select: { id: true } },
  task: {
    select: {
      id: true,
      title: true,
      color: true,
      estimatedSeconds: true,
      defaultMode: true,
      plannedIntervals: true,
      completedAt: true,
    },
  },
} as const;

type BlockRow = {
  id: string;
  title: string;
  notes: string | null;
  date: Date;
  startMinute: number;
  endMinute: number;
  kind: BlockKind;
  completedAt: Date | null;
  cueForId: string | null;
  cue: { id: string } | null;
  task: CalendarBlock["task"];
};

const toCalendarBlock = (row: BlockRow): CalendarBlock => ({
  id: row.id,
  title: row.title,
  notes: row.notes,
  dateISO: toISODate(row.date),
  startMinute: row.startMinute,
  endMinute: row.endMinute,
  kind: row.kind,
  completedAt: row.completedAt,
  cueForId: row.cueForId,
  hasCue: row.cue !== null,
  task: row.task,
});

/**
 * Every block from `start` to `start + days`, inclusive of the first day and
 * exclusive of the day after the last.
 *
 * One query for a whole week: the `[userId, date, startMinute]` index makes it
 * a range scan, and a week is a few dozen rows, so there is nothing to gain
 * from paging it per day.
 */
export async function getBlocks(
  user: User,
  start: Date,
  days: number,
): Promise<CalendarBlock[]> {
  const rows = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: addDays(start, days) },
    },
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    select: blockSelect,
  });

  return rows.map(toCalendarBlock);
}

/** Group blocks by their ISO date, so a week grid can index straight into it. */
export function blocksByDate(
  blocks: CalendarBlock[],
): Map<string, CalendarBlock[]> {
  const grouped = new Map<string, CalendarBlock[]>();
  for (const block of blocks) {
    const list = grouped.get(block.dateISO) ?? [];
    list.push(block);
    grouped.set(block.dateISO, list);
  }
  return grouped;
}

/**
 * The ISO dates that have at least one block, across a range. One lightweight
 * read for the mini-month navigator's dots — a month of days is what it
 * renders, so asking it for a month of days costs exactly one query.
 */
export async function getBlockedDays(
  user: User,
  start: Date,
  days: number,
): Promise<Set<string>> {
  const rows = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lt: addDays(start, days) },
    },
    select: { date: true },
    distinct: ["date"],
  });

  return new Set(rows.map((row) => toISODate(row.date)));
}

/**
 * What actually happened on these days, per task, so the calendar can put
 * planned and logged next to each other.
 *
 * Recovery is excluded from the task roll-up for the same reason it's excluded
 * from the stats headline: it is never attached to a task, and folding it in
 * would inflate every "you planned 2h and spent 3h".
 */
export async function getLoggedByTask(
  user: User,
  start: Date,
  days: number,
): Promise<Map<string, number>> {
  const rows = await prisma.focusSession.groupBy({
    by: ["taskId"],
    where: {
      userId: user.id,
      localDate: { gte: start, lt: addDays(start, days) },
      mode: { not: "RECOVERY" },
      taskId: { not: null },
    },
    _sum: { elapsedSeconds: true },
  });

  return new Map(
    rows
      .filter((row): row is typeof row & { taskId: string } => row.taskId !== null)
      .map((row) => [row.taskId, row._sum.elapsedSeconds ?? 0]),
  );
}

export type SchedulableItem = {
  id: string;
  /** Habits come first in the panel and carry no due date; todos do. */
  kind: "task" | "habit";
  title: string;
  /** The calendar hue the panel's dot wears. */
  color: string;
  estimatedSeconds: number | null;
  dueDate: Date | null;
  priority: "P1" | "P2" | "P3" | "P4" | null;
  project: { name: string } | null;
  firstStep: string | null;
  /**
   * The anchor's name, when this habit is stacked on something. Carried so the
   * panel can warn that dropping this in brings a second block with it —
   * scheduling one thing and getting two is only a good surprise once.
   */
  cueTitle: string | null;
  /**
   * Habits only: the habit was due the day before the one being planned and has
   * no DONE behind it. A deliberate skip or a day it isn't scheduled for is not
   * a miss. Exists to stop two missed days in a row, not to tally them.
   */
  missedPriorDay: boolean;
};

/**
 * Everything still owed on the day being planned: open todos, plus the habits
 * that are due that day and haven't been done or skipped yet.
 *
 * Both are dropped once they're already blocked out — the panel is a list of
 * what's *missing* from the day, so an item that's on the grid has no business
 * still sitting in it.
 *
 * Capped, and ordered so habits and then real deadlines surface first. A
 * scheduling panel that lists your entire backlog is a backlog review, and a
 * backlog review at 9am is how the morning gets eaten.
 */
export async function getSchedulableItems(
  user: User,
  date: Date,
  limit = 12,
): Promise<SchedulableItem[]> {
  const alreadyBlocked = await prisma.timeBlock.findMany({
    where: { userId: user.id, date, taskId: { not: null } },
    select: { taskId: true },
  });

  const excluded = alreadyBlocked
    .map((block) => block.taskId)
    .filter((id): id is string => id !== null);

  const notBlocked = excluded.length > 0 ? { id: { notIn: excluded } } : {};

  const [todos, habits, occurrences, priorOccurrences] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        type: "TODO",
        completedAt: null,
        archivedAt: null,
        ...notBlocked,
      },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { sortOrder: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        color: true,
        estimatedSeconds: true,
        dueDate: true,
        priority: true,
        project: { select: { name: true } },
        steps: {
          where: { completedAt: null },
          orderBy: { position: "asc" },
          take: 1,
          select: { title: true },
        },
      },
    }),
    // Not filtered by day in SQL: which days a habit is due is computed from
    // the rule, never stored, so the day filter has to happen in JS.
    prisma.task.findMany({
      where: {
        userId: user.id,
        type: "HABIT",
        archivedAt: null,
        recurrence: { isNot: null },
        ...notBlocked,
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        color: true,
        estimatedSeconds: true,
        project: { select: { name: true } },
        recurrence: {
          select: { daysOfWeek: true, startDate: true, endDate: true },
        },
        cue: {
          select: {
            anchorTaskId: true,
            anchorLabel: true,
            anchorTask: { select: { title: true } },
          },
        },
      },
    }),
    // No row at all means "not done" — occurrences only exist for days that
    // were actually touched.
    prisma.taskOccurrence.findMany({
      where: {
        userId: user.id,
        date,
        status: { in: ["DONE", "SKIPPED"] },
      },
      select: { taskId: true },
    }),
    // Yesterday's touch, for the "missed yesterday" marker: what the habit was
    // the day before the one being planned, so a habit due today can warn when
    // it was silently dropped the day before.
    prisma.taskOccurrence.findMany({
      where: {
        userId: user.id,
        date: addDays(date, -1),
        status: { in: ["DONE", "SKIPPED"] },
      },
      select: { taskId: true, status: true },
    }),
  ]);

  const settled = new Set(occurrences.map((occurrence) => occurrence.taskId));

  const priorStatus = new Map<string, "DONE" | "SKIPPED">(
    priorOccurrences.map((occurrence) => [
      occurrence.taskId,
      occurrence.status as "DONE" | "SKIPPED",
    ]),
  );
  const priorISO = toISODate(addDays(date, -1));
  const completionsForPriorDay = (
    taskId: string,
  ): Map<string, "DONE" | "SKIPPED"> => {
    const status = priorStatus.get(taskId);
    return status ? new Map([[priorISO, status]]) : new Map();
  };

  const dueHabits: SchedulableItem[] = habits
    .filter(
      (habit) =>
        habit.recurrence !== null &&
        !settled.has(habit.id) &&
        isDueOn(habit.recurrence, date),
    )
    .map((habit) => ({
      id: habit.id,
      kind: "habit" as const,
      title: habit.title,
      color: habit.color,
      estimatedSeconds: habit.estimatedSeconds,
      dueDate: null,
      priority: null,
      project: habit.project,
      firstStep: null,
      cueTitle: habit.cue
        ? anchorTitleOf(habit.cue, habit.cue.anchorTask?.title)
        : null,
      missedPriorDay: wasMissedOn(
        habit.recurrence!,
        completionsForPriorDay(habit.id),
        addDays(date, -1),
      ),
    }));

  const openTodos: SchedulableItem[] = todos.map((task) => ({
    id: task.id,
    kind: "task" as const,
    title: task.title,
    color: task.color,
    estimatedSeconds: task.estimatedSeconds,
    dueDate: task.dueDate,
    priority: task.priority,
    project: task.project,
    firstStep: task.steps[0]?.title ?? null,
    cueTitle: null,
    missedPriorDay: false,
  }));

  return [...dueHabits, ...openTodos].slice(0, limit);
}

// ---------------------------------------------------------------- summaries

export type DayPlan = {
  dateISO: string;
  blocks: CalendarBlock[];
  /** Overlaps counted once — this is "how much of the day is spoken for". */
  claimedMinutes: number;
  workMinutes: number;
  recoveryMinutes: number;
  bufferMinutes: number;
};

export function summariseDay(dateISO: string, blocks: CalendarBlock[]): DayPlan {
  const of = (kind: BlockKind): Span[] =>
    blocks.filter((block) => block.kind === kind);

  return {
    dateISO,
    blocks,
    claimedMinutes: claimedMinutes(blocks),
    workMinutes: claimedMinutes(of("WORK")),
    recoveryMinutes: claimedMinutes(of("RECOVERY")),
    bufferMinutes: claimedMinutes(of("BUFFER")),
  };
}
