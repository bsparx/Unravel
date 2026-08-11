import Link from "next/link";
import {
  Archive,
  BarChart3,
  NotebookPen,
  Pencil,
  Plus,
  Repeat,
  Timer,
} from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState } from "@/components/empty-state";
import { MissedYesterdayBadge } from "@/components/missed-yesterday-badge";
import { QuotaMeter } from "@/components/quota-meter";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { addDays, formatMinutes, toISODate, todayLocal } from "@/lib/dates";
import { chainOf, cueEdges } from "@/lib/habit-cue";
import { describeQuota } from "@/lib/quota";
import { getHabits } from "@/lib/tasks";
import {
  describeRecurrence,
  expectedDatesBetween,
  isDueOn,
  wasMissedOn,
} from "@/lib/recurrence";
import { buildTimerHref } from "@/lib/timer-url";

import { archiveHabit, deleteHabit } from "./actions";
import { HabitCard } from "./_components/habit-card";
import { HabitCueLine, HabitStackTrail } from "./_components/habit-cue-line";
import { HabitFeedbackButton } from "./_components/habit-feedback-button";
import { HabitGrid } from "./_components/habit-grid";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const habits = await getHabits(user);

  const active = habits.filter((habit) => habit.archivedAt === null);
  const archived = habits.filter((habit) => habit.archivedAt !== null);

  // The stack graph, built once from what's already in memory: a habit's cue
  // names one predecessor, and following those names gives the whole chain.
  const edges = cueEdges(
    habits.map((habit) => ({
      taskId: habit.id,
      anchorTaskId: habit.cue?.anchorTaskId ?? null,
    })),
  );
  const titleById = new Map(habits.map((habit) => [habit.id, habit.title]));

  /** The stack in front of a habit as display strings, earliest first. */
  const stackTrail = (habitId: string): string[] => {
    const ids = chainOf(habitId, edges);
    const rootCue = habits.find((habit) => habit.id === ids[0])?.cue;
    // The root's own anchor is a label, not a habit — so it has no id and can
    // only come from the cue row itself.
    const rootLabel =
      rootCue && !rootCue.anchorTaskId ? rootCue.anchorTitle : null;

    return [
      ...(rootLabel ? [rootLabel] : []),
      ...ids.map((id) => titleById.get(id) ?? "—"),
    ];
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display">Habits</h1>
          <p className="text-muted-foreground mt-1 text-label">
            Recurring things. They only appear on the days you chose.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/habits/stats">
              <BarChart3 className="size-4" aria-hidden />
              Statistics
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/habits/new">
              <Plus className="size-4" aria-hidden />
              Add
            </Link>
          </Button>
        </div>
      </header>

      {active.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="A habit is anything you want to come back to on a schedule — daily, weekdays, or whichever days you pick."
          action={
            <Button asChild size="sm">
              <Link href="/habits/new">Add a habit</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {active.map((habit) => {
            const missedYesterday = wasMissedOn(
              habit.rule,
              habit.history,
              addDays(today, -1),
            );
            const expected = expectedDatesBetween(
              habit.rule,
              addDays(today, -55),
              today,
            ).length;
            const done = [...habit.history.values()].filter(
              (status) => status === "DONE",
            ).length;
            const adherence =
              expected > 0 ? Math.round((done / expected) * 100) : 0;

            return (
              <HabitCard
                key={habit.id}
                name={habit.title}
                adherence={adherence}
                cue={habit.cue ? <HabitCueLine cue={habit.cue} /> : null}
                title={
                  <div className="flex min-w-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link href={`/habits/${habit.id}/log`}>
                        <NotebookPen className="size-3.5" aria-hidden />
                        Log
                      </Link>
                    </Button>
                    <Link
                      href={buildTimerHref({
                        id: habit.id,
                        estimatedSeconds: habit.estimatedSeconds,
                        defaultMode: habit.defaultMode,
                        plannedIntervals: habit.plannedIntervals,
                      })}
                      className="focus-visible:ring-ring hover:text-primary font-display min-w-0 truncate rounded text-title focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {habit.title}
                    </Link>
                  </div>
                }
                actions={
                  <>
                    <Button asChild variant="ghost" size="icon">
                      <Link
                        href={`/habits/${habit.id}`}
                        aria-label={`Edit ${habit.title}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                    </Button>
                    <form action={archiveHabit}>
                      <input type="hidden" name="taskId" value={habit.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Archive ${habit.title}`}
                      >
                        <Archive className="size-4" aria-hidden />
                      </Button>
                    </form>
                  </>
                }
                quota={
                  <div className="space-y-1.5">
                    <QuotaMeter
                      taskId={habit.id}
                      dateISO={toISODate(today)}
                      quota={habit.quota}
                      progress={habit.todayProgress}
                    />
                    {habit.requiresFeedback &&
                      isDueOn(habit.rule, today) &&
                      !habit.history.get(toISODate(today)) &&
                      habit.todayProgress >= habit.quota.minimum &&
                      !habit.todayNote && (
                        <HabitFeedbackButton
                          taskId={habit.id}
                          title={habit.title}
                          dateISO={toISODate(today)}
                          prompt={habit.feedbackPrompt}
                        />
                      )}
                  </div>
                }
                meta={
                  <>
                    <HabitStackTrail steps={stackTrail(habit.id)} />
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                      <span>{describeRecurrence(habit.daysOfWeek)}</span>
                      <span>{describeQuota(habit.quota)}</span>
                      {habit.estimatedSeconds ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Timer className="size-3" aria-hidden />
                          {formatMinutes(habit.estimatedSeconds)}
                        </span>
                      ) : null}
                      {missedYesterday && <MissedYesterdayBadge />}
                    </p>
                  </>
                }
              >
                <HabitGrid
                  rule={habit.rule}
                  history={habit.history}
                  tiers={habit.tiers}
                  today={today}
                />
              </HabitCard>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-micro text-muted-foreground mb-2 font-sans font-medium tracking-wider uppercase">
            Archived
          </h2>
          <ul className="space-y-1">
            {archived.map((habit) => (
              <li
                key={habit.id}
                className="text-muted-foreground flex items-center justify-between gap-4 text-label"
              >
                <span className="truncate">{habit.title}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={archiveHabit}>
                    <input type="hidden" name="taskId" value={habit.id} />
                    <input type="hidden" name="restore" value="true" />
                    <Button type="submit" variant="ghost" size="sm">
                      Restore
                    </Button>
                  </form>
                  <ConfirmDelete
                    action={deleteHabit}
                    taskId={habit.id}
                    label="Delete"
                    size="sm"
                    title={`Delete "${habit.title}" for good?`}
                    description="This removes the habit, its full streak and tick history, every session you logged against it, and any calendar blocks pointing at it. Your stats totals will change. Restoring it is no longer an option."
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
