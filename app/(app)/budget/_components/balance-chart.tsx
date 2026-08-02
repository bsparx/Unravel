"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
import { formatMoney } from "@/lib/money";

/**
 * The month's running balance, day by day, with last month's line beneath it
 * in brass — the palette's dormant fifth wheel, woken for the one comparison
 * that matters. Above the line is a good month; below it, the jar is dry.
 */
const BALANCE_CONFIG = {
  balance: { label: "This month", color: "var(--primary)" },
  lastMonth: { label: "Last month", color: "var(--chart-2)" },
} satisfies ChartConfig;

const compactThousand = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

export function BalanceChart({
  balance,
  lastMonth,
  monthName,
}: {
  /** Cumulative balance per day of month. */
  balance: { day: number; cents: number }[];
  /** Last month's cumulative balance, indexed by this month's day; null where the previous month had no such day. */
  lastMonth: (number | null)[];
  /** "August" — for the tooltip's date. */
  monthName: string;
}) {
  const gradientId = useId();

  const data = balance.map((point, index) => ({
    day: point.day,
    cents: point.cents,
    lastCents: lastMonth[index] ?? null,
  }));

  return (
    <ChartContainer config={BALANCE_CONFIG} className="h-48 w-full">
      <AreaChart data={data} margin={{ left: -4, right: 4, top: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          className="text-micro"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={compactThousand}
          className="text-micro"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatMoney(Number(value))}
              labelFormatter={(day) => `${monthName} ${day}`}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <ReferenceLine
          y={0}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <Area
          name="balance"
          dataKey="cents"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3.5 }}
        />
        <Line
          name="lastMonth"
          dataKey="lastCents"
          type="monotone"
          stroke="var(--color-lastMonth)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
