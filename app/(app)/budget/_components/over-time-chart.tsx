"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/money";

import { MoneyTooltip, rupeeTick } from "./chart-bits";
import { useLedgerNav } from "./ledger-shell";
import { ledgerPath, ledgerSearch, PAGE_SIZE, type LedgerKind, type LedgerQuery } from "../_lib/ledger";
import type { LedgerData } from "../_lib/queries";

/**
 * One side of the ledger across the span, a bar per day, week or month. A
 * single series, so no legend: the card's title says what it is. A tap on a
 * bar zooms the whole page into that bar's days.
 */
export function OverTimeChart({
  kind,
  query,
  series,
  average,
  unit,
}: {
  kind: LedgerKind;
  query: LedgerQuery;
  series: LedgerData["series"];
  average: LedgerData["average"];
  unit: LedgerData["unit"];
}) {
  const nav = useLedgerNav();
  const color = kind === "INCOME" ? "var(--money-in)" : "var(--money-out)";
  const config = { value: { label: kind === "INCOME" ? "Came in" : "Went out", color } } satisfies ChartConfig;
  const data = series.map((point) => ({ ...point, value: point.cents / 100 }));
  // The average only means something against bars of the same size.
  const line = average && average.per === unit ? average.cents / 100 : null;

  // Day bars are as far in as it goes; a week or a month opens its own days.
  // No hovered index (a touch can bring none) opens nothing.
  const zoom = (index: unknown) => {
    if (index === null || index === undefined || index === "") return;
    const point = series[Number(index)];
    if (!point || !nav || unit === "day") return;
    nav.go(ledgerPath(kind) + ledgerSearch({ ...query, range: "custom", from: point.start, to: point.end, limit: PAGE_SIZE }));
  };

  return (
    <>
      <ChartContainer config={config} className="aspect-auto min-h-60 w-full flex-1">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ left: 0, right: 4, top: 8, bottom: 0 }}
          barCategoryGap={2}
          className={unit === "day" ? undefined : "cursor-pointer"}
          onClick={(state) => zoom(state?.activeTooltipIndex)}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={14}
            interval="preserveStartEnd"
          />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={rupeeTick} />
          <ChartTooltip
            cursor={{ fill: "var(--accent)", opacity: 0.45 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !point) return null;
              return (
                <MoneyTooltip
                  title={point.label}
                  rows={[
                    {
                      key: "value",
                      label: kind === "INCOME" ? "came in" : "went out",
                      color,
                      cents: point.cents,
                    },
                  ]}
                  footer={unit === "day" ? undefined : "Tap to see these days"}
                />
              );
            }}
          />
          {line !== null && (
            <ReferenceLine
              y={line}
              stroke="var(--muted-foreground)"
              strokeOpacity={0.6}
              strokeDasharray="4 4"
              label={{
                value: `avg ${formatMoneyCompact(Math.round(line * 100))}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            onClick={(_, index) => zoom(index)}
          />
        </BarChart>
      </ChartContainer>

      <table className="sr-only">
        <caption>{kind === "INCOME" ? "Income" : "Spending"} over time</caption>
        <tbody>
          {series.map((point) => (
            <tr key={point.start}>
              <th scope="row">{point.label}</th>
              <td>{formatMoneyCompact(point.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
