"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * The small pieces every budget chart shares, so they read as one family:
 * the axis numbers, the tooltip box, the frame a chart is drawn in and the
 * card it sits on.
 *
 * Chart data is in rupees, not paise, so the axis lands on round numbers a
 * person would say (0, 5K, 10K) instead of round numbers of paise.
 */

const COMPACT = new Intl.NumberFormat("en-PK", { notation: "compact", maximumFractionDigits: 1 });

/** Axis ticks: 0, 950, 1.5K, 24.5K, 2.5M. */
export const rupeeTick = (rupees: number) => COMPACT.format(rupees);

type Size = { width: number; height: number };

/**
 * The box a chart is drawn in, measured before the chart first draws.
 *
 * Recharts can't know its box on the server, so left alone it renders at a
 * stock 320 by 200 and corrects itself once the page is live. Until then the
 * bars were squeezed into the wrong height (the first category's name rode up
 * over the card's subtitle) and could poke past a phone's edge. So the server
 * sends only the empty box, at its real height; the browser measures it
 * before the first paint and the chart starts at the right size. Resizes
 * after that are the chart's own business.
 */
export function ChartFrame({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: (size: Size) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setSize({ width: Math.round(box.width), height: Math.round(box.height) });
  }, []);

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", className)} style={style}>
      {size && children(size)}
    </div>
  );
}

/**
 * The tooltip, value first: the reader already knows which bar they're on
 * and wants the number. A short stroke of the series colour keys each row.
 */
export function MoneyTooltip({
  title,
  rows,
  footer,
}: {
  title: ReactNode;
  rows: { key: string; label: string; color: string; cents: number }[];
  footer?: ReactNode;
}) {
  return (
    <div className="bg-popover text-popover-foreground border-border/70 grid min-w-40 gap-1.5 rounded-lg border px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{title}</p>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="font-mono font-medium tabular-nums">{formatMoneyCompact(row.cents)}</span>
          <span className="text-muted-foreground">{row.label}</span>
        </div>
      ))}
      {footer && <p className="text-muted-foreground border-border/60 border-t pt-1.5">{footer}</p>}
    </div>
  );
}

/**
 * A titled panel for one chart, with an optional link or control at its top
 * right. Its body grows, so a chart beside a taller card can fill the height.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-border bg-card flex min-w-0 flex-col rounded-lg border p-4 md:p-5 ${className ?? ""}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-micro mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
