"use client";

import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { BudgetCategory } from "../_lib/queries";

/** How many categories the donut names before folding the rest together. */
const SLICE_LIMIT = 5;

type Slice = {
  id: string;
  name: string;
  fill: string;
  value: number;
};

/** The config is only here so ChartContainer will render a styled tooltip. */
const DONUT_CONFIG = {
  slice: { label: "Amount" },
} satisfies ChartConfig;

/**
 * One question at a time: the donut shows *one* side of the ledger, chosen
 * with the toggle above it — money in and money out are different shapes of
 * the month, and mixing them into one circle would ask for arithmetic.
 */
export function CategoryDonut({
  categories,
}: {
  categories: { category: BudgetCategory; totalCents: number }[];
}) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  const filtered = categories.filter(
    (entry) => entry.category.kind === kind,
  );
  const total = filtered.reduce((sum, entry) => sum + entry.totalCents, 0);

  const sorted = [...filtered].sort((a, b) => b.totalCents - a.totalCents);
  const named = sorted.slice(0, SLICE_LIMIT);
  const folded = sorted.slice(SLICE_LIMIT);
  const foldedTotal = folded.reduce((sum, entry) => sum + entry.totalCents, 0);

  const slices: Slice[] = [
    ...named.map((entry) => ({
      id: entry.category.id,
      name: entry.category.name,
      fill: CATEGORY_COLORS[entry.category.color] ?? "var(--muted-foreground)",
      value: entry.totalCents,
    })),
    ...(foldedTotal > 0
      ? [{ id: "rest", name: "Everything else", fill: "var(--muted-foreground)", value: foldedTotal }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(["INCOME", "EXPENSE"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={cn(
              "focus-visible:ring-ring rounded-full px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
              kind === option
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "INCOME" ? "Where it came from" : "Where it went"}
          </button>
        ))}
      </div>

      {slices.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-label">
          Nothing {kind === "INCOME" ? "brought in" : "spent"} this month yet.
        </p>
      ) : (
        <div className="grid items-center gap-2 sm:grid-cols-2">
          <div className="relative mx-auto h-44 w-full max-w-56">
            <ChartContainer config={DONUT_CONFIG} className="h-full w-full">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.id} fill={slice.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatMoney(Number(value))}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-title tabular-nums">
                {formatMoneyCompact(total)}
              </span>
              <span className="text-muted-foreground text-micro">
                {kind === "INCOME" ? "in" : "out"} this month
              </span>
            </div>
          </div>

          <ul className="space-y-1.5">
            {slices.map((slice) => (
              <li
                key={slice.id}
                className="flex items-center gap-2.5 text-label"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.fill }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                <span className="font-mono shrink-0 tabular-nums">
                  {formatMoneyCompact(slice.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
