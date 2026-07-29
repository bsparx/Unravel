"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDuration } from "@/lib/dates";
import { formatQuota, type Quota } from "@/lib/quota";

/**
 * Colour, once, for every chart on this page.
 *
 * Optimal is the full primary; minimum is the same hue at half strength. That
 * relationship is deliberate — a good day is *more of the same thing*, not a
 * different thing, and giving optimal its own hue would read as two unrelated
 * metrics. Missed is the clay destructive, and skipped is neutral grey because
 * a deliberate "not today" is not a failure.
 *
 * Amber appears nowhere here. It stays reserved for a clock that is running.
 */
const OUTCOME_CONFIG = {
  optimal: { label: "Optimal", color: "var(--primary)" },
  minimum: { label: "Minimum", color: "color-mix(in oklab, var(--primary) 50%, var(--card))" },
  skipped: { label: "Skipped", color: "var(--muted-foreground)" },
  missed: { label: "Missed", color: "var(--destructive)" },
} satisfies ChartConfig;

const shortDate = (dateISO: string) => dateISO.slice(8) + "/" + dateISO.slice(5, 7);

/**
 * Days you hit it, stacked.
 *
 * Stacked rather than grouped because minimum and optimal are tiers of one
 * thing: the total height is "days you turned up", and the split inside it is
 * how well. Grouped bars would invite reading them as competing series.
 */
export function OutcomesChart({
  daily,
}: {
  daily: {
    dateISO: string;
    optimal: number;
    minimum: number;
    missed: number;
    skipped: number;
  }[];
}) {
  return (
    <ChartContainer config={OUTCOME_CONFIG} className="h-56 w-full">
      <BarChart data={daily} margin={{ left: -20, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateISO"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          className="text-micro"
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={40}
          className="text-micro"
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(value) => String(value)} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="optimal" stackId="a" fill="var(--color-optimal)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="minimum" stackId="a" fill="var(--color-minimum)" />
        <Bar dataKey="skipped" stackId="a" fill="var(--color-skipped)" fillOpacity={0.35} />
        <Bar dataKey="missed" stackId="a" fill="var(--color-missed)" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

const TIME_CONFIG = {
  minutes: { label: "On habits", color: "var(--primary)" },
} satisfies ChartConfig;

/** Time spent on the selected habits, per day. */
export function TimeChart({
  daily,
}: {
  daily: { dateISO: string; loggedSeconds: number }[];
}) {
  const data = daily.map((day) => ({
    dateISO: day.dateISO,
    minutes: Math.round(day.loggedSeconds / 60),
  }));

  return (
    <ChartContainer config={TIME_CONFIG} className="h-48 w-full">
      {/* `left: -20` pulls the plot toward the axis on the count charts, whose
          ticks are one or two characters. Here the ticks carry an "m" suffix and
          the same margin clips them to nothing — so this one gets its own. */}
      <BarChart data={data} margin={{ left: -4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateISO"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          className="text-micro"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          className="text-micro"
          tickFormatter={(value: number) => `${value}m`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatDuration(Number(value) * 60)}
            />
          }
        />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/**
 * One habit's daily progress against both its bars.
 *
 * Only shown when a single habit is selected, because the y-axis is in that
 * habit's own unit — plotting pages and minutes on one axis would be nonsense.
 * The two reference lines are what make the shape readable: you can see at a
 * glance how many days cleared the low bar without touching the high one, which
 * is exactly the picture the two-quota idea is trying to give you.
 */
export function ProgressChart({
  days,
  quota,
}: {
  days: { dateISO: string; progress: number; outcome: string }[];
  quota: Quota;
}) {
  const config = {
    progress: { label: formatQuota(1, quota.unit).split(" ")[1], color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <LineChart data={days} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateISO"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          className="text-micro"
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={40}
          className="text-micro"
        />
        <ChartTooltip content={<ChartTooltipContent />} />

        <ReferenceLine
          y={quota.minimum}
          stroke="var(--primary)"
          strokeDasharray="4 4"
          label={{
            value: "minimum",
            position: "insideBottomLeft",
            className: "fill-muted-foreground text-micro",
          }}
        />
        {quota.optimal !== null && (
          <ReferenceLine
            y={quota.optimal}
            stroke="var(--primary)"
            strokeOpacity={0.5}
            strokeDasharray="2 6"
            label={{
              value: "good day",
              position: "insideTopLeft",
              className: "fill-muted-foreground text-micro",
            }}
          />
        )}

        <Line
          type="monotone"
          dataKey="progress"
          stroke="var(--color-progress)"
          strokeWidth={2}
          dot={{ r: 2.5 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

const ADHERENCE_CONFIG = {
  adherence: { label: "Kept", color: "var(--primary)" },
} satisfies ChartConfig;

/**
 * Adherence per habit, as a horizontal ranking.
 *
 * Bars are tinted by how much of the adherence came from good days rather than
 * bare minimums, so "I show up every day but only just" and "I show up every
 * day properly" don't render identically.
 */
export function AdherenceChart({
  habits,
}: {
  habits: { title: string; adherence: number; optimalShare: number }[];
}) {
  return (
    <ChartContainer
      config={ADHERENCE_CONFIG}
      className="w-full"
      style={{ height: Math.max(120, habits.length * 38) }}
    >
      <BarChart
        data={habits}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(value: number) => `${value}%`}
          tickLine={false}
          axisLine={false}
          className="text-micro"
        />
        <YAxis
          type="category"
          dataKey="title"
          width={130}
          // interval={0} is load-bearing: without it recharts drops labels it
          // judges to be overlapping, which on a chart whose entire job is
          // comparing habits means silently unlabelling half of them.
          interval={0}
          tickLine={false}
          axisLine={false}
          className="text-micro"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => `${value}% of due days`} />
          }
        />
        <Bar dataKey="adherence" radius={[0, 3, 3, 0]}>
          {habits.map((habit) => (
            <Cell
              key={habit.title}
              fill="var(--color-adherence)"
              // 0% optimal reads as a pale bar, 100% as the full primary.
              fillOpacity={0.4 + (habit.optimalShare / 100) * 0.6}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
