import Link from "next/link";
import {
  BarChart3,
  NotebookPen,
  Plus,
  Repeat,
  Timer,
} from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState } from "@/components/empty-state";
import { HabitDayControl } from "@/components/habit-day";
import { MissedYesterdayBadge } from "@/components/missed-yesterday-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  addDays,
  formatDateWithWeekday,
  formatMinutes,
  toISODate,
  todayLocal,
} from "@/lib/dates";
import { chainOf, cueEdges } from "@/lib/habit-cue";
import { describeSlots } from "@/lib/habit-slots";
import { describeBar, showedUp } from "@/lib/habit-bar";
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
import { HabitMoreMenu } from "./_components/habit-more-menu";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const habits = await getHabits(user);

  const active = habits.filter((habit) => habit.archivedAt === null);
  const archived = habits.filter((habit) => habit.archivedAt !== null);
  const groups = [
    { title: "Due today", habits: active.filter((habit) => isDueOn(habit.rule, today)) },
    { title: "Other days", habits: active.filter((habit) => !isDueOn(habit.rule, today)) },
  ];

  // The note dialog's spread: every active habit and today's note, so the
  // one being written sits among its siblings on the left page.
  const todayISO = toISODate(today);
  const dayIndex = active.map((habit) => ({
    id: habit.id,
    title: habit.title,
    done: habit.history.get(todayISO) === "DONE",
    note: habit.todayNote,
  }));

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
      ...ids.map((id) => titleById.get(id) ?? "Untitled habit"),
    ];
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display">Habits</h1>
          <p className="text-muted-foreground mt-1 text-label">
            Your minimum action is enough to complete the day.
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
              Add habit
            </Link>
          </Button>
        </div>
      </header>

      {active.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="A habit is anything you want to come back to on a schedule: daily, weekdays, or whichever days you pick."
          action={
            <Button asChild size="sm">
              <Link href="/habits/new">Add a habit</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            (group.title === "Due today" || group.habits.length > 0) && (
              <section key={group.title} aria-labelledby={`habits-${group.title === "Due today" ? "today" : "other"}`}>
                <div className="mb-4">
                  <h2 id={`habits-${group.title === "Due today" ? "today" : "other"}`} className="font-sans text-heading font-semibold">
                    {group.title}
                    <span className="text-muted-foreground ml-3 text-label font-normal tabular-nums">{group.habits.length}</span>
                  </h2>
                  {group.title === "Other days" && (
                    <p className="text-muted-foreground mt-1 text-label">Outside today&apos;s schedule. You can still check in.</p>
                  )}
                </div>
                {group.habits.length === 0 ? (
                  <p className="border-border bg-card rounded-[1.25rem] border p-6 text-muted-foreground">Nothing due today. Your other habits are below.</p>
                ) : (
                  <ul className="space-y-4">
                    {group.habits.map((habit) => {
                      const missedYesterday = wasMissedOn(
                        habit.rule,
                        habit.history,
                        addDays(today, -1),
                      );
                      const expectedDates = expectedDatesBetween(
                        habit.rule,
                        addDays(today, -55),
                        today,
                      );
                      const expected = expectedDates.length;
                      const done = expectedDates.filter(
                        (date) => habit.history.get(toISODate(date)) === "DONE",
                      ).length;
                      const adherence =
                        expected > 0 ? Math.round((done / expected) * 100) : 0;

                      return (
                        <HabitCard
                          key={habit.id}
                          name={habit.title}
                          adherence={adherence}
                          cue={habit.cue ? <HabitCueLine cue={habit.cue} /> : null}
                          id={`habit-${habit.id}`}
                          title={<h3 className="font-sans text-title font-semibold leading-snug">{habit.title}</h3>}
                          actions={
                            <>
                              <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5">
                                <Link
                                  href={buildTimerHref({
                                    id: habit.id,
                                    estimatedSeconds: habit.estimatedSeconds,
                                    defaultMode: habit.defaultMode,
                                    plannedIntervals: habit.plannedIntervals,
                                  })}
                                  aria-label={`Start ${habit.title}`}
                                >
                                  <Timer className="size-4" aria-hidden />
                                  Start
                                </Link>
                              </Button>
                              <HabitMoreMenu taskId={habit.id} name={habit.title} />
                            </>
                          }
                          day={
                            <div className="space-y-1.5">
                              <HabitDayControl
                                prominent
                                taskId={habit.id}
                                dateISO={toISODate(today)}
                                bar={habit.bar}
                                progress={habit.today.progress}
                                done={habit.history.get(toISODate(today)) === "DONE"}
                                label={habit.title}
                                identities={habit.identities.map((identity) => identity.name)}
                              />
                              {habit.requiresFeedback &&
                                isDueOn(habit.rule, today) &&
                                !habit.history.get(toISODate(today)) &&
                                showedUp(habit.today) &&
                                !habit.todayNote && (
                                  <HabitFeedbackButton
                                    taskId={habit.id}
                                    title={habit.title}
                                    dateISO={todayISO}
                                    dateLabel={formatDateWithWeekday(today)}
                                    prompt={habit.feedbackPrompt}
                                    dayIndex={dayIndex}
                                  />
                                )}
                            </div>
                          }
                          meta={
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <HabitStackTrail steps={stackTrail(habit.id)} />
                                <Button asChild variant="outline" size="sm" className="min-h-11">
                                  <Link href={`/habits/${habit.id}/log`} aria-label={`Open the log for ${habit.title}`}>
                                    <NotebookPen className="size-4" aria-hidden />
                                    Log
                                  </Link>
                                </Button>
                              </div>
                              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                                {habit.identities.map((identity) => (
                                  <span
                                    key={identity.id}
                                    className="border-border rounded-full border px-2 py-0.5 text-micro"
                                  >
                                    {identity.name}
                                  </span>
                                ))}
                                <span>{describeRecurrence(habit.daysOfWeek)}</span>
                                <span>{describeSlots(habit.slots)}</span>
                                <span>{describeBar(habit.bar)}</span>
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
                            wentBeyond={habit.wentBeyond}
                            today={today}
                          />
                        </HabitCard>
                      );
                    })}
                  </ul>
                )}
              </section>
            )
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="text-muted-foreground mb-4 font-sans text-heading font-semibold">
            Archived
          </h2>
          <ul className="space-y-1">
            {archived.map((habit) => (
              <li
                key={habit.id}
                className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 py-2 text-label"
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
