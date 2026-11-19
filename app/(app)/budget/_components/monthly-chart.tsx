"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/money";

import { ChartFrame, MoneyTooltip, rupeeTick } from "./chart-bits";
import type { BudgetOverview } from "../_lib/queries";

const CONFIG = {
  income: { label: "Came in", color: "var(--money-in)" },
  expense: { label: "Went out", color: "var(--money-out)" },
} satisfies ChartConfig;

type Month = BudgetOverview["months"][number];

function keptLine(month: Month): string {
  const net = month.incomeCents - month.expenseCents;
  if (month.incomeCents === 0 && month.expenseCents === 0) return "Nothing logged";
  if (net === 0) return "Came out even";
  return net > 0 ? `Kept ${formatMoneyCompact(net)}` : `${formatMoneyCompact(-net)} more went out`;
}

/**
 * In against out for the last six months, side by side per month. The month
 * on show has its label in full ink; a tap on any other month opens it.
 */
export function MonthlyChart({ months, activeStart }: { months: Month[]; activeStart: string }) {
  const router = useRouter();
  const data = months.map((month) => ({
    ...month,
    income: month.incomeCents / 100,
    expense: month.expenseCents / 100,
  }));

  // A tap lands on a bar (its own index) or on the column around it (the
  // hovered index). A touch may bring no hovered index at all, so a missing
  // one opens nothing rather than the first month.
  const open = (index: unknown) => {
    if (index === null || index === undefined || index === "") return;
    const month = data[Number(index)];
    if (month && month.start !== activeStart) {
      router.push(`/budget?m=${month.start.slice(0, 7)}`, { scroll: false });
    }
  };

  return (
    <>
      <ChartFrame className="min-h-60 flex-1">
        {(size) => (
          <ChartContainer config={CONFIG} initialDimension={size} className="aspect-auto h-full w-full">
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ left: 0, right: 4, top: 8, bottom: 0 }}
              barGap={2}
              barCategoryGap="22%"
              className="cursor-pointer"
              onClick={(state) => open(state?.activeTooltipIndex)}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="tick"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={({ x, y, payload, index }) => {
                  const active = data[index]?.start === activeStart;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={10}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={active ? 600 : 400}
                      style={{ fill: active ? "var(--foreground)" : "var(--muted-foreground)" }}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={rupeeTick} />
              <ChartTooltip
                cursor={{ fill: "var(--accent)", opacity: 0.45 }}
                content={({ active, payload }) => {
                  const month = payload?.[0]?.payload as Month | undefined;
                  if (!active || !month) return null;
                  return (
                    <MoneyTooltip
                      title={month.label}
                      rows={[
                        { key: "in", label: "came in", color: "var(--money-in)", cents: month.incomeCents },
                        { key: "out", label: "went out", color: "var(--money-out)", cents: month.expenseCents },
                      ]}
                      footer={keptLine(month)}
                    />
                  );
                }}
              />
              <ChartLegend
                verticalAlign="top"
                align="right"
                itemSorter={null}
                content={<ChartLegendContent verticalAlign="top" className="justify-end" />}
              />
              <Bar
                dataKey="income"
                fill="var(--color-income)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                onClick={(_, index) => open(index)}
              />
              <Bar
                dataKey="expense"
                fill="var(--color-expense)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                onClick={(_, index) => open(index)}
              />
            </BarChart>
          </ChartContainer>
        )}
      </ChartFrame>

      <table className="sr-only">
        <caption>Money in and out by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Came in</th>
            <th scope="col">Went out</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.start}>
              <th scope="row">{month.label}</th>
              <td>{formatMoneyCompact(month.incomeCents)}</td>
              <td>{formatMoneyCompact(month.expenseCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
