/**
 * Quest → timer/calendar links, shared by the hero and the log.
 *
 * One place so a quest never opens two different timers: an objective's
 * handle is the first line still standing, and a habit's clock is set from
 * its estimate exactly the way the task rows do it.
 */

import { DEFAULTS } from "@/lib/timer-math";
import type { TodayItem } from "@/lib/tasks";
import { buildTimerHref, RECOVERY_HREF } from "@/lib/timer-url";

import type { Quest, QuestObjective } from "@/lib/day-quests";

export const objectiveHref = (objective: QuestObjective) =>
  buildTimerHref({
    id: objective.id,
    estimatedSeconds: objective.estimatedSeconds,
    defaultMode: objective.defaultMode,
    plannedIntervals: objective.plannedIntervals,
  });

export const habitHref = (item: TodayItem) =>
  buildTimerHref({
    id: item.id,
    estimatedSeconds:
      item.type === "HABIT"
        ? (item.estimatedSeconds ?? DEFAULTS.targetSeconds)
        : item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
  });

/**
 * Where a quest row leads. A task-bearing quest opens the timer on its next
 * line; recovery opens the recovery timer; a named claim on time ("gym")
 * opens the calendar, since there is nothing to put a clock against.
 */
export function questHref(quest: Quest, calendarHref: string): string {
  if (quest.kind === "RECOVERY") return RECOVERY_HREF;
  if (quest.kind === "HABIT" && quest.habit) return habitHref(quest.habit);

  if (quest.objectives.length > 0) {
    const target =
      quest.objectives.find((objective) => objective.doneAt === null) ??
      quest.objectives[0];
    return objectiveHref(target);
  }

  return calendarHref;
}
