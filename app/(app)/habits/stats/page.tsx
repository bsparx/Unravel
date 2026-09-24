import Link from "next/link";
import { ArrowLeft, BarChart3, Flame } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatDuration } from "@/lib/dates";
import {
  getHabitStats,
  isStatsRange,
  RANGE_DAYS,
  type StatsRange,
} from "@/lib/habit-stats";
import { getIdentityReinforcements } from "@/lib/identity-stats";
import { describeBar, formatLogged } from "@/lib/habit-bar";
import { describeRecurrence } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

import {
  IdentitiesPanel,
  NeedsFocusPanel,
} from "./_components/identity-panels";
import {
  AdherenceChart,
  OutcomesChart,
  ProgressChart,
  TimeChart,
} from "./_components/habit-charts";
import { HabitFilters } from "./_components/habit-filters";

export const metadata = { title: "Habit statistics" };

export default async function HabitStatsPage({
  searchParams,
}: PageProps<"/habits/stats">) {
  const user = await requireUser();
  const params = await searchParams;

  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range: StatsRange = isStatsRange(rawRange) ? rawRange : "month";

  const rawHabits = params.habit;
  const selected = Array.isArray(rawHabits)
    ? rawHabits
    : rawHabits
      ? [rawHabits]
      : [];

  const stats = await getHabitStats(user, range, selected);
  // The identity tally over the same selection: the filters govern the whole
  // page, identity rows included.
  const identityStats = await getIdentityReinforcements(user, stats.habits, range);
  // A single habit means the y-axis has one unit, which is the only case where
  // plotting raw progress makes sense.
  const single = stats.habits.length === 1 ? stats.habits[0] : null;

  if (stats.allHabits.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <BackLink />
        <EmptyState
          icon={BarChart3}
          title="No habits to measure yet"
          description="Add a habit with a minimal task and this fills in: what you kept, what you missed, and how often you kept going."
          action={
            <Button asChild size="sm">
              <Link href="/habits/new">Add a habit</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <BackLink />

      <header className="mb-6">
        <h1 className="text-display">Habit statistics</h1>
        <p className="text-muted-foreground mt-1 text-label">
          The smallest version that counts is the whole day; anything past it
          is logged, never required.
        </p>
      </header>

      <div className="border-border mb-8 rounded-lg border p-4">
        <HabitFilters
          range={range}
          selected={selected}
          habits={stats.allHabits}
        />
      </div>

      <section className="mb-10 grid gap-3 sm:grid-cols-4">
        <Stat
          label="Kept"
          value={`${stats.totals.adherence}%`}
          detail={`${stats.totals.doneDays} of ${
            stats.totals.expected
          } due days`}
        />
        <Stat
          label="Kept going"
          value={String(stats.totals.wentBeyondDays)}
          detail="past the minimal task"
        />
        <Stat
          label="Missed"
          value={String(stats.totals.missedDays)}
          detail={
            stats.totals.skippedDays > 0
              ? `${stats.totals.skippedDays} skipped on purpose`
              : "days nothing was done"
          }
        />
        <Stat
          label="Time on habits"
          value={formatDuration(stats.totals.loggedSeconds)}
          detail={`over ${RANGE_DAYS[range]} days`}
        />
      </section>

      {identityStats.identities.some(
        (identity) => identity.linked.length > 0,
      ) && (
        <section className="mb-10 space-y-10">
          <IdentitiesPanel identities={identityStats.identities} />
          <NeedsFocusPanel focus={identityStats.focus} />
        </section>
      )}

      <div className="space-y-10">
        <Panel
          title="Every day"
          subtitle="Done, skipped, and missed partition the same due days. Bar height is how many habits you turned up for."
        >
          <OutcomesChart daily={stats.daily} />
        </Panel>

        <Panel
          title="Time spent"
          subtitle="Only what a timer actually recorded against a habit."
        >
          <TimeChart daily={stats.daily} />
        </Panel>

        {single ? (
          <Panel
            title={`${single.title}, day by day`}
            subtitle={`Measured in ${
              single.bar.unit === "MINUTES" ? "minutes" : "times"
            }. ${describeBar(single.bar)}.`}
          >
            <ProgressChart days={single.days} bar={single.bar} />
          </Panel>
        ) : (
          stats.habits.length > 1 && (
            <Panel
              title="Which ones are sticking"
              subtitle="Percent of due days where the minimal task happened."
            >
              <AdherenceChart
                habits={stats.habits.map((habit) => ({
                  title: habit.title,
                  adherence: habit.adherence,
                }))}
              />
            </Panel>
          )
        )}

        <Panel title="Habit by habit">
          <ul className="space-y-3">
            {stats.habits.map((habit) => (
              <li
                key={habit.id}
                className="border-border bg-card rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <Link
                      href={`/habits/${habit.id}`}
                      className="font-display hover:text-primary focus-visible:ring-ring rounded text-title focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {habit.title}
                    </Link>
                    <p className="text-muted-foreground text-label">
                      {describeRecurrence(habit.daysOfWeek)} ·{" "}
                      {describeBar(habit.bar)}
                    </p>
                  </div>

                  {habit.currentStreak > 0 && (
                    <span className="text-running inline-flex shrink-0 items-center gap-1 text-label tabular-nums">
                      <Flame className="size-3.5" aria-hidden />
                      {habit.currentStreak} in a row
                      <span className="text-muted-foreground">
                        · best {habit.longestStreak}
                      </span>
                    </span>
                  )}
                </div>

                {/* One bar, split by outcome. Reads left to right as best to
                    worst, so the shape of the row is the summary. */}
                <div className="bg-muted mt-3 flex h-2 w-full overflow-hidden rounded-full">
                  <Segment
                    value={habit.doneDays}
                    total={habit.expected}
                    className="bg-primary"
                    label={`${habit.doneDays} done`}
                  />
                  <Segment
                    value={habit.skippedDays}
                    total={habit.expected}
                    className="bg-muted-foreground/30"
                    label={`${habit.skippedDays} skipped`}
                  />
                  <Segment
                    value={habit.missedDays}
                    total={habit.expected}
                    className="bg-destructive/45"
                    label={`${habit.missedDays} missed`}
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label sm:grid-cols-4">
                  <Cell label="Kept" value={`${habit.adherence}%`} />
                  <Cell
                    label="Kept going"
                    value={`${habit.wentBeyondDays}`}
                    detail={
                      habit.doneDays > 0
                        ? `${habit.wentBeyondShare}% of days done`
                        : undefined
                    }
                  />
                  <Cell label="Missed" value={`${habit.missedDays}`} />
                  <Cell
                    label="Time"
                    value={formatDuration(habit.loggedSeconds)}
                    detail={
                      habit.bar.unit === "COUNT"
                        ? formatLogged(habit.totalProgress, habit.bar.unit)
                        : undefined
                    }
                  />
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/habits"
      className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Habits
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-title">{title}</h2>
      {subtitle && (
        <p className="text-muted-foreground mt-0.5 mb-3 max-w-prose text-label">
          {subtitle}
        </p>
      )}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Segment({
  value,
  total,
  className,
  label,
}: {
  value: number;
  total: number;
  className: string;
  label: string;
}) {
  if (value <= 0 || total <= 0) return null;
  return (
    <span
      title={label}
      className={className}
      style={{ width: `${(value / total) * 100}%` }}
    />
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border bg-card rounded-lg border px-4 py-3">
      <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="font-mono mt-1 text-heading tabular-nums">{value}</p>
      <p className="text-muted-foreground text-label">{detail}</p>
    </div>
  );
}

function Cell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </dt>
      <dd className={cn("font-mono tabular-nums")}>{value}</dd>
      {detail && <p className="text-muted-foreground text-micro">{detail}</p>}
    </div>
  );
}
