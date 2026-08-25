import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { breaksWorthReporting } from "@/lib/break-stats";
import { formatDuration } from "@/lib/dates";
import { MODE_LABELS } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

import { BalancePanel } from "./_components/balance-panel";
import { BarList } from "./_components/bar-list";
import { FocusHeatmap } from "./_components/focus-heatmap";
import { getStats, RANGE_DAYS, type StatsRange } from "./_lib/queries";

export const metadata = { title: "Time" };

const RANGES: { value: StatsRange; label: string }[] = [
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "quarter", label: "90 days" },
];

export default async function StatsPage({
  searchParams,
}: PageProps<"/stats">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const raw = Array.isArray(params.range) ? params.range[0] : params.range;
  const range: StatsRange =
    raw === "week" || raw === "month" || raw === "quarter" ? raw : "month";

  const stats = await getStats(user, range);
  const hasData =
    stats.totals.seconds > 0 || stats.balance.recoverySessions > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display">Time</h1>
          <p className="text-muted-foreground mt-1 text-label">
            Where it actually went, not where you meant it to go.
          </p>
        </div>

        <nav aria-label="Range" className="flex gap-1">
          {RANGES.map((option) => (
            <Link
              key={option.value}
              href={`/stats?range=${option.value}`}
              aria-current={range === option.value ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring rounded-full px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                range === option.value
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing on the clock yet"
          description="Run a timer on anything — or tick a task done and log how long it took — and this fills in: how long things really take, which days you get traction, and how far off your estimates are."
          action={
            <Button asChild size="sm">
              <Link href="/day">Go to your day</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Today"
              value={formatDuration(stats.todaySeconds)}
              detail={`${stats.todaySessions} work session${
                stats.todaySessions === 1 ? "" : "s"
              }`}
            />
            <Stat
              label="This week"
              value={formatDuration(stats.weekSeconds)}
              detail="of work, since your week started"
            />
            <Stat
              label={`Last ${RANGE_DAYS[range]} days`}
              value={formatDuration(stats.totals.seconds)}
              detail={`${stats.totals.sessions} session${
                stats.totals.sessions === 1 ? "" : "s"
              }`}
            />
          </section>

          <Panel
            title="Work and recovery"
            subtitle="Both halves of the day, on the same scale. Rest isn't what you earn by focusing — it's the other side of it."
          >
            <BalancePanel balance={stats.balance} />
          </Panel>

          <Panel title="Every day" subtitle="Darker means more focus time.">
            <FocusHeatmap daily={stats.daily} />
          </Panel>

          {stats.timeByTask.length > 0 && (
            <Panel title="Where the time went">
              <BarList
                rows={stats.timeByTask.map((task) => ({
                  key: task.id,
                  label: task.title,
                  sublabel: task.project?.name,
                  seconds: task.seconds,
                }))}
              />
            </Panel>
          )}

          {stats.timeByProject.length > 1 && (
            <Panel title="By list">
              <BarList
                rows={stats.timeByProject.map((project) => ({
                  key: project.name,
                  label: project.name,
                  seconds: project.seconds,
                }))}
              />
            </Panel>
          )}

          <Panel
            title="How wrong were your estimates?"
            subtitle="The most useful number here. Consistently over isn't a failure — it's a calibration you can start using."
          >
            {stats.estimateAccuracy.medianRatio === null ? (
              <p className="text-muted-foreground text-label">
                Add a time estimate to a task and run a timer on it, and this
                starts working.
              </p>
            ) : (
              <>
                <p className="text-body">
                  Things typically take{" "}
                  <span className="font-mono text-title tabular-nums">
                    {stats.estimateAccuracy.medianRatio.toFixed(2)}×
                  </span>{" "}
                  your estimate
                  <span className="text-muted-foreground">
                    {" "}
                    across {stats.estimateAccuracy.sampleSize} task
                    {stats.estimateAccuracy.sampleSize === 1 ? "" : "s"}.
                  </span>
                </p>

                {stats.estimateAccuracy.worstUnderestimates.length > 0 && (
                  <ul className="mt-4 space-y-2 text-label">
                    {stats.estimateAccuracy.worstUnderestimates.map((task) => (
                      <li
                        key={task.id}
                        className="border-border/60 flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0"
                      >
                        <span className="truncate">{task.title}</span>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatDuration(task.estimatedSeconds)} planned ·{" "}
                          <span className="text-destructive">
                            {formatDuration(task.seconds)} actual
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Panel>

          {stats.habitAdherence.length > 0 && (
            <Panel
              title="Habits"
              subtitle="Only counting the days each habit was actually due."
            >
              <ul className="space-y-2.5">
                {stats.habitAdherence.map((habit) => (
                  <li key={habit.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-4 text-label">
                      <span className="truncate">{habit.title}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">
                        {habit.done}/{habit.expected} · {habit.adherence}%
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${habit.adherence}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Which timer you reach for">
              {/* Recovery is excluded on purpose — it isn't a timer you reach
                  for, it's the other half of the day. It has its own panel. */}
              <BarList
                rows={stats.byMode
                  .filter((row) => row.mode !== "RECOVERY")
                  .map((row) => ({
                    key: row.mode,
                    label: MODE_LABELS[row.mode],
                    sublabel: `${row.sessions} session${
                      row.sessions === 1 ? "" : "s"
                    }`,
                    seconds: row.seconds,
                  }))}
              />
            </Panel>

            <Panel title="When you focus best">
              <TimeOfDay byHour={stats.byHour} />
            </Panel>
          </div>

          <Panel title="Focus quality">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Pauses per session"
                value={stats.totals.avgPauses.toFixed(1)}
              />
              <Metric
                label="Focus blocks finished"
                value={String(stats.totals.completedIntervals)}
                detail={`of ${stats.totals.plannedIntervals} planned`}
              />
              <Metric
                label="Time past your goal"
                value={formatDuration(stats.totals.overtimeSeconds)}
                detail="flow sessions and overruns"
              />
            </dl>
          </Panel>

          {stats.breaks.count > 0 && (
            <Panel
              title="Getting back"
              subtitle="Breaks are the part of the day that stretches. This is by how much."
            >
              <dl className="grid gap-4 sm:grid-cols-3">
                <Metric
                  label="Breaks taken"
                  value={String(stats.breaks.count)}
                  detail={
                    stats.breaks.overranCount > 0
                      ? `${stats.breaks.overranCount} ran over`
                      : "none ran over"
                  }
                />
                <Metric
                  label="Time past the break"
                  value={formatDuration(stats.breaks.overrunSeconds)}
                  detail="not counted toward any task"
                />
                <Metric
                  label="Taken on purpose"
                  value={formatDuration(stats.breaks.extendedSeconds)}
                  detail="five more minutes, chosen"
                />
              </dl>

              {/* One sentence, and only when there is genuinely a gap between
                  what gets chosen and what happens. A permanent line here would
                  be a stat that exists to make someone feel watched. */}
              {breaksWorthReporting(stats.breaks) && (
                <p className="text-muted-foreground mt-4 text-label text-balance">
                  You pick{" "}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatDuration(stats.breaks.medianPlannedSeconds)}
                  </span>
                  , and the middle one runs{" "}
                  <span className="text-foreground font-medium tabular-nums">
                    {formatDuration(stats.breaks.medianTakenSeconds)}
                  </span>
                  . Setting the break to what it actually is tends to work
                  better than intending the short one again.
                </p>
              )}
            </Panel>
          )}
        </div>
      )}
    </div>
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
        <p className="text-muted-foreground mt-0.5 mb-3 text-label">
          {subtitle}
        </p>
      )}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Metric({
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
      <dd className="font-mono mt-0.5 text-title tabular-nums">{value}</dd>
      {detail && <p className="text-muted-foreground text-label">{detail}</p>}
    </div>
  );
}

function TimeOfDay({ byHour }: { byHour: { hour: number; seconds: number }[] }) {
  const max = Math.max(...byHour.map((row) => row.seconds), 1);

  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]">
        {byHour.map((row) => (
          <div
            key={row.hour}
            title={`${String(row.hour).padStart(2, "0")}:00 — ${formatDuration(
              row.seconds,
            )}`}
            className="bg-primary/70 hover:bg-primary min-h-[2px] flex-1 rounded-t-[2px] transition-colors"
            style={{ height: `${Math.max(2, (row.seconds / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-micro tabular-nums">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}
