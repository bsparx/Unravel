import Link from "next/link";
import { Archive, BarChart3, Flame, Pencil, Plus, Repeat, Timer } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { QuotaMeter } from "@/components/quota-meter";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { addDays, formatMinutes, toISODate, todayLocal } from "@/lib/dates";
import { describeQuota } from "@/lib/quota";
import { getHabits } from "@/lib/tasks";
import {
  computeStreak,
  describeRecurrence,
  expectedDatesBetween,
} from "@/lib/recurrence";
import { buildTimerHref } from "@/lib/timer-url";

import { archiveHabit } from "./actions";
import { HabitCard } from "./_components/habit-card";
import { HabitGrid } from "./_components/habit-grid";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const habits = await getHabits(user);

  const active = habits.filter((habit) => habit.archivedAt === null);
  const archived = habits.filter((habit) => habit.archivedAt !== null);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
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
            const streak = computeStreak(habit.rule, habit.history, today);
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
                title={
                  <Link
                    href={buildTimerHref({
                      id: habit.id,
                      estimatedSeconds: habit.estimatedSeconds,
                      defaultMode: habit.defaultMode,
                      plannedIntervals: habit.plannedIntervals,
                    })}
                    className="focus-visible:ring-ring hover:text-primary font-display block truncate rounded text-title focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {habit.title}
                  </Link>
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
                  <QuotaMeter
                    taskId={habit.id}
                    dateISO={toISODate(today)}
                    quota={habit.quota}
                    progress={habit.todayProgress}
                  />
                }
                meta={
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
                    <span>{describeRecurrence(habit.daysOfWeek)}</span>
                    <span>{describeQuota(habit.quota)}</span>
                    {habit.estimatedSeconds ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Timer className="size-3" aria-hidden />
                        {formatMinutes(habit.estimatedSeconds)}
                      </span>
                    ) : null}
                    {streak.current > 0 && (
                      <span className="text-running inline-flex items-center gap-1 tabular-nums">
                        <Flame className="size-3" aria-hidden />
                        {streak.current} in a row
                      </span>
                    )}
                  </p>
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
                <form action={archiveHabit}>
                  <input type="hidden" name="taskId" value={habit.id} />
                  <input type="hidden" name="restore" value="true" />
                  <Button type="submit" variant="ghost" size="sm">
                    Restore
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
