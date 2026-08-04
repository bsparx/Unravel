import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  addDays,
  addMonths,
  eachDateInRange,
  formatMonthLabel,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayLocal,
  WEEKDAYS,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Six rows of seven, so the month's cells never shift when the 1st moves. */
const CELLS = 42;

/**
 * The mini-month navigator: Google's sidebar calendar — a month at a glance,
 * today ringed, days that have blocks dotted, a click anywhere jumping to
 * that day. Purely navigational; the grid beside it is where planning
 * happens, so nothing here opens a dialog.
 */
export function MonthStrip({
  month,
  anchor,
  weekStart,
  timeZone,
  blockedDays,
}: {
  /** The first local day of the month being shown. */
  month: Date;
  /** The day being viewed — ringed in the grid, like Google's selected day. */
  anchor: Date;
  /** 0 = Sunday .. 6 = Saturday — the user's week start, same as the grid. */
  weekStart: number;
  timeZone: string;
  /** ISO dates that carry at least one block. */
  blockedDays: Set<string>;
}) {
  const todayISO = toISODate(todayLocal(timeZone));
  const anchorISO = toISODate(anchor);
  const gridStart = startOfWeek(startOfMonth(month), weekStart);
  const cells = eachDateInRange(gridStart, addDays(gridStart, CELLS - 1));
  const weekdayLabels = [
    ...WEEKDAYS.slice(weekStart),
    ...WEEKDAYS.slice(0, weekStart),
  ].map((day) => day.short);

  return (
    <section className="border-border bg-card rounded-lg border">
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <Link
          href={`/calendar?view=day&date=${toISODate(addMonths(month, -1))}`}
          aria-label="Previous month"
          className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <h2 className="text-title">{formatMonthLabel(month)}</h2>
        <Link
          href={`/calendar?view=day&date=${toISODate(addMonths(month, 1))}`}
          aria-label="Next month"
          className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </header>

      <div
        className="grid gap-y-0.5 px-3 pt-2 pb-3"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {weekdayLabels.map((label) => (
          <p
            key={label}
            className="text-micro text-muted-foreground pb-1 text-center font-medium tracking-wider uppercase"
          >
            {label}
          </p>
        ))}
        {cells.map((date) => {
          const iso = toISODate(date);
          const inMonth = date.getUTCMonth() === month.getUTCMonth();
          const isToday = iso === todayISO;
          const isAnchor = iso === anchorISO;
          const hasBlocks = blockedDays.has(iso);
          return (
            <Link
              key={iso}
              href={`/calendar?view=day&date=${iso}`}
              aria-label={toISODate(date)}
              className={cn(
                "focus-visible:ring-ring relative mx-auto grid size-7 place-items-center rounded-full text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isToday
                  ? "bg-primary text-primary-foreground font-medium"
                  : isAnchor
                    ? "bg-accent text-foreground font-medium"
                    : inMonth
                      ? "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      : "text-muted-foreground/35 hover:bg-accent/40",
              )}
            >
              {date.getUTCDate()}
              {hasBlocks && !isToday && (
                <span
                  className={cn(
                    "absolute bottom-0.5 size-1 rounded-full",
                    isAnchor ? "bg-foreground/50" : "bg-primary/60",
                  )}
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
