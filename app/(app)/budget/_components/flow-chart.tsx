"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
 * Colour, once, for the money charts: in is the teal of anything going well,
 * out is the clay of "the thing to notice". The pair is the whole story of a
 * budget month, so it gets the only two semantic colours the palette spends.
 */
const FLOW_CONFIG = {
  income: { label: "In", color: "var(--primary)" },
  expense: { label: "Out", color: "var(--destructive)" },
} satisfies ChartConfig;

const compactThousand = (value: number) =>
  value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

/** Money in and money out, week by week across the month. */
export function FlowChart({
  weeks,
}: {
  weeks: { label: string; incomeCents: number; expenseCents: number }[];
}) {
  return (
    <ChartContainer config={FLOW_CONFIG} className="h-48 w-full">
      <BarChart data={weeks} margin={{ left: -4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
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
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          name="In"
          dataKey="income"
          fill="var(--color-income)"
          radius={[3, 3, 0, 0]}
        />
        <Bar
          name="Out"
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
