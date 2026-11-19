"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatMoneyCompact } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/money-palette";

import { MoneyTooltip } from "./chart-bits";
import { useLedgerNav } from "./ledger-shell";
import type { CategoryBar } from "../_lib/ledger";

/** Height of one row: the name above, the bar below. */
const ROW = 46;
const NAME_CHARS = 30;

const truncate = (text: string) => (text.length > NAME_CHARS ? `${text.slice(0, NAME_CHARS - 1)}…` : text);

/**
 * Where the money went (or came from), as ranked bars on one baseline:
 * biggest first, one hue, the amount at each bar's tip and the name above
 * it, so a long name never fights the bar for room. Bars compare more
 * exactly than the slices of a donut, which is why this replaced one.
 *
 * With `selectedId`, the chosen category keeps the hue and the rest go quiet,
 * so it reads against the whole. A tap on a bar opens its entries.
 */
export function CategoryBars({
  rows,
  tone,
  selectedId = null,
  label,
}: {
  rows: CategoryBar[];
  tone: "in" | "out";
  selectedId?: string | null;
  /** Names the chart for screen readers: "November's spending by category". */
  label: string;
}) {
  const router = useRouter();
  const nav = useLedgerNav();
  const go = (href: string) => (nav ? nav.go(href) : router.push(href));

  const color = tone === "in" ? "var(--money-in)" : "var(--money-out)";
  const total = rows.reduce((sum, row) => sum + row.cents, 0);
  const data = rows.map((row) => ({
    ...row,
    value: row.cents / 100,
    fill: row.color === null || (selectedId !== null && row.id !== selectedId) ? "var(--money-quiet)" : color,
    dot: row.color ? (CATEGORY_COLORS[row.color] ?? "var(--muted-foreground)") : "var(--muted-foreground)",
  }));
  const config = { value: { label: tone === "in" ? "Came in" : "Went out", color } } satisfies ChartConfig;

  return (
    <>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: rows.length * ROW + 4 }}>
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 76, top: 4, bottom: 0 }}
          barCategoryGap={0}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="name" hide />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !row) return null;
              const share = total > 0 ? Math.round((row.cents / total) * 100) : 0;
              return (
                <MoneyTooltip
                  title={row.name}
                  rows={[{ key: "value", label: `${share}% of it`, color: row.fill, cents: row.cents }]}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            minPointSize={2}
            className="cursor-pointer"
            onClick={(_, index) => {
              const row = data[index];
              if (row) go(row.href);
            }}
          >
            {data.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="name"
              content={({ x, y, index }) => {
                const row = data[Number(index)];
                if (!row) return null;
                const left = Number(x);
                const top = Number(y);
                return (
                  <g>
                    <circle cx={left + 4} cy={top - 10} r={4} fill={row.dot} />
                    <text x={left + 14} y={top - 6} fontSize={13} style={{ fill: "var(--foreground)" }}>
                      {truncate(row.name)}
                    </text>
                  </g>
                );
              }}
            />
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              fontSize={12}
              className="tabular-nums"
              style={{ fill: "var(--muted-foreground)" }}
              formatter={(value) => formatMoneyCompact(Math.round(Number(value) * 100))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{formatMoneyCompact(row.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
