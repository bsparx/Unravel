/**
 * The day page's quest timeline — pure functions, no React, no Prisma.
 *
 * /calendar plans stretches of time; /day is where those stretches become the
 * day's quests. This module is the join: it merges the day's blocks and the
 * anchored habits that aren't already spoken for into one ordered timeline,
 * reads each quest's state against the current minute, and picks the one
 * thing the hero should name — the quest in progress, the one about to
 * unlock, or, when the schedule is quiet, the first quest that can be done
 * right now.
 *
 * The game grammar is deliberately thin: quests have states and unlock times,
 * not points. It feeds the reward loop the app already trusts — ticking a
 * line, watching a number that only goes down — and invents no score.
 */

import { blockLabel } from "@/lib/block-math";
import { START_HERE_LOOKAHEAD_MINUTES } from "@/lib/habit-timeline";
import type { TodayItem } from "@/lib/tasks";
import type { BlockTask, CalendarBlock } from "@/lib/time-blocks";

// ---------------------------------------------------------------- types

export type QuestKind = "WORK" | "RECOVERY" | "BUFFER" | "HABIT";

export type QuestState = "COMPLETE" | "ACTIVE" | "UPCOMING" | "PAST";

/** One tickable line inside a block — the quest's objective list. */
export type QuestObjective = {
  id: string;
  title: string;
  doneAt: Date | null;
  estimatedSeconds: number | null;
  defaultMode: "POMODORO" | "BASIC" | "FLOW" | "RECOVERY";
  plannedIntervals: number | null;
};

export type Quest = {
  /** The block id for block quests; the task id for habit quests. */
  id: string;
  kind: QuestKind;
  /** A habit-stack cue sitting before its habit — rendered, but never the hero. */
  isCue: boolean;
  title: string;
  notes: string | null;
  startMinute: number;
  endMinute: number;
  state: QuestState;
  objectives: QuestObjective[];
  /** The habit behind a HABIT quest, for the timer link and quota meta. */
  habit: TodayItem | null;
};

/**
 * What the hero card should be. One kind per state of the day, in the
 * precedence `pickHeroQuest` documents.
 */
export type HeroPick =
  | { kind: "ACTIVE_QUEST"; quest: Quest; /** Other quests in their window right now. */ moreActive: number }
  | { kind: "REST_ACTIVE"; quest: Quest }
  | { kind: "FREE_ROAM"; untilMinute: number | null; next: Quest | null }
  | { kind: "NEXT_QUEST"; quest: Quest }
  | { kind: "AVAILABLE"; item: TodayItem }
  | { kind: "ALL_DONE"; completedCount: number }
  | { kind: "NOTHING_PLANNED" };

/** The quest-less fallback pool, shaped the way /day's page already holds it. */
export type AvailablePool = {
  overdue: TodayItem[];
  dueToday: TodayItem[];
  undated: TodayItem[];
  /** Habits with no time anchor — the pool never contains an anchored one,
   * because anchored habits are quests on the timeline instead. */
  unanchored: TodayItem[];
  completedCount: number;
};

// ---------------------------------------------------------------- timeline

const isCueBlock = (block: CalendarBlock) => block.cueForId !== null;

const toObjectives = (tasks: BlockTask[]): QuestObjective[] =>
  tasks.map((task) => ({
    id: task.id,
    title: task.title,
    doneAt: task.doneAt,
    estimatedSeconds: task.estimatedSeconds,
    defaultMode: task.defaultMode,
    plannedIntervals: task.plannedIntervals,
  }));

function blockQuest(block: CalendarBlock, nowMinute: number): Quest {
  const state: QuestState =
    block.completedAt !== null
      ? "COMPLETE"
      : block.startMinute <= nowMinute && nowMinute < block.endMinute
        ? "ACTIVE"
        : block.endMinute <= nowMinute
          ? "PAST"
          : "UPCOMING";

  return {
    id: block.id,
    // /day filters DAYDREAM blocks out before they get here — the page's
    // contract, which is why the cast is safe and the type is narrower.
    kind: block.kind as QuestKind,
    isCue: isCueBlock(block),
    title: blockLabel(block),
    notes: block.notes,
    startMinute: block.startMinute,
    endMinute: block.endMinute,
    state,
    objectives: toObjectives(block.tasks),
    habit: null,
  };
}

/**
 * Every quest with a time on it, in day order.
 *
 * A habit scheduled into a block is already spoken for — the block speaks for
 * it, the same rule the calendar's scheduling panel uses — so only unclaimed
 * anchored habits become quests of their own. Unanchored habits and todos
 * never enter the timeline; they are the available pool the hero falls back to.
 */
export function buildQuestTimeline({
  blocks,
  habits,
  nowMinute,
}: {
  blocks: CalendarBlock[];
  /** Today's not-done habits, already slot-filtered — /day's own list. */
  habits: TodayItem[];
  nowMinute: number;
}): Quest[] {
  const blockedTaskIds = new Set(
    blocks.flatMap((block) => block.tasks.map((task) => task.id)),
  );

  const habitQuests: Quest[] = habits
    .filter(
      (habit) =>
        habit.timeAnchorMinutes !== null && !blockedTaskIds.has(habit.id),
    )
    .map((habit) => {
      const anchor = habit.timeAnchorMinutes as number;
      return {
        id: habit.id,
        kind: "HABIT" as const,
        isCue: false,
        title: habit.title,
        notes: habit.notes,
        startMinute: anchor,
        endMinute: anchor,
        state: (anchor <= nowMinute ? "ACTIVE" : "UPCOMING") as QuestState,
        objectives: [],
        habit,
      };
    });

  return [...blocks.map((b) => blockQuest(b, nowMinute)), ...habitQuests].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
}

// ---------------------------------------------------------------- hero pick

const isRealQuestKind = (kind: QuestKind) =>
  kind === "WORK" || kind === "RECOVERY" || kind === "HABIT";

/**
 * The one thing the hero card names.
 *
 * Precedence, in order:
 *
 * 1. The active work quest — a claimed stretch whose window is open is the
 *    plan's current answer to "what now".
 * 2. The active recovery quest — rest with a window outranks a habit moment,
 *    because the plan put you here on purpose.
 * 3. The arrived habit — the anchored one whose moment it is, not yet done.
 * 4. Free roam — only open time is claimed right now; the card names the next
 *    quest and the countdown to it.
 * 5. The next quest — but only within the same lookahead window the old
 *    "start here" pick used; a quest six hours away is not what to start.
 * 6. The available pool — overdue, due today, anytime, then unanchored habits.
 * 7. All done, or nothing planned at all.
 */
export function pickHeroQuest(
  quests: Quest[],
  available: AvailablePool,
  nowMinute: number,
): HeroPick {
  const active = quests.filter((q) => q.state === "ACTIVE");
  const activeWork = active.filter((q) => q.kind === "WORK" && !q.isCue);
  const activeRest = active.filter((q) => q.kind === "RECOVERY");
  const activeBuffer = active.filter((q) => q.kind === "BUFFER");
  const arrivedHabit = active
    .filter((q) => q.kind === "HABIT")
    .sort((a, b) => b.startMinute - a.startMinute)[0];

  if (activeWork.length > 0) {
    return {
      kind: "ACTIVE_QUEST",
      quest: activeWork[0],
      moreActive: active.filter((q) => q.id !== activeWork[0].id && isRealQuestKind(q.kind)).length,
    };
  }

  if (activeRest.length > 0) return { kind: "REST_ACTIVE", quest: activeRest[0] };

  if (arrivedHabit) return { kind: "ACTIVE_QUEST", quest: arrivedHabit, moreActive: 0 };

  const upcoming = quests
    .filter((q) => q.state === "UPCOMING" && !q.isCue)
    .sort((a, b) => a.startMinute - b.startMinute);
  const next = upcoming[0] ?? null;

  if (activeBuffer.length > 0) {
    return {
      kind: "FREE_ROAM",
      untilMinute: Math.max(...activeBuffer.map((q) => q.endMinute)),
      next,
    };
  }

  const fallback =
    available.overdue[0] ??
    available.dueToday[0] ??
    available.undated[0] ??
    available.unanchored[0] ??
    null;

  if (next) {
    const withinLookahead =
      next.startMinute - nowMinute <= START_HERE_LOOKAHEAD_MINUTES;
    // A quest about to unlock outranks the backlog; one hours away does not.
    if (withinLookahead || !fallback) return { kind: "NEXT_QUEST", quest: next };
  }

  if (fallback) return { kind: "AVAILABLE", item: fallback };

  return available.completedCount > 0
    ? { kind: "ALL_DONE", completedCount: available.completedCount }
    : { kind: "NOTHING_PLANNED" };
}

// ---------------------------------------------------------------- counts

/**
 * The log header's "2/5 complete": quests ticked, over quests with a time on
 * the day. Cues count — they are claimed minutes like any other.
 */
export function questProgress(quests: Quest[]): {
  complete: number;
  total: number;
} {
  return {
    complete: quests.filter((q) => q.state === "COMPLETE").length,
    total: quests.length,
  };
}
