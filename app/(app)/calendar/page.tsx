import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  claimedMinutes,
  formatMinuteLength,
  freeSlots,
} from "@/lib/block-math";
import {
  addDays,
  formatDate,
  formatFullDate,
  parseLocalDate,
  startOfWeek,
  toISODate,
  todayLocal,
  WEEKDAYS,
} from "@/lib/dates";
import { getBlocks, getSchedulableItems } from "@/lib/time-blocks";
import { cn } from "@/lib/utils";

import { CalendarView } from "./_components/calendar-view";
import type { GridDay } from "./_components/calendar-grid";
import { SchedulePanel } from "./_components/schedule-panel";

export const metadata = { title: "Calendar" };

type View = "day" | "week";

/** The window "how much is left today" is measured against. */
const WAKING_START = 7 * 60;
const WAKING_END = 22 * 60;

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const view: View = first("view") === "day" ? "day" : "week";
  const today = todayLocal(user.timezone);
  // A malformed date degrades to today rather than 404ing — this is a URL
  // people will hand-edit.
  const anchor = (first("date") ? parseLocalDate(first("date")!) : null) ?? today;

  const start = view === "week" ? startOfWeek(anchor, user.weekStart) : anchor;
  const length = view === "week" ? 7 : 1;

  const [blocks, schedulable] = await Promise.all([
    getBlocks(user, start, length),
    getSchedulableItems(user, anchor),
  ]);

  const days: GridDay[] = Array.from({ length }, (_, offset) => {
    const date = addDays(start, offset);
    return {
      dateISO: toISODate(date),
      label: formatDate(date),
      weekday: WEEKDAYS[date.getUTCDay()].short,
      isToday: date.getTime() === today.getTime(),
    };
  });

  const step = view === "week" ? 7 : 1;
  const hrefFor = (date: Date) =>
    `/calendar?view=${view}&date=${toISODate(date)}`;

  // "How much of the day is spoken for" is measured against waking hours, not
  // 24 — three hours blocked out of a 24-hour day sounds like nothing and is
  // actually most of an evening.
  const anchorISO = toISODate(anchor);
  const anchorBlocks = blocks.filter((block) => block.dateISO === anchorISO);
  const claimed = claimedMinutes(anchorBlocks);
  const open = freeSlots(anchorBlocks, WAKING_START, WAKING_END);
  const longestFree = open.reduce(
    (best, slot) => Math.max(best, slot.endMinute - slot.startMinute),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-label">
            {view === "day"
              ? formatFullDate(anchor)
              : `${formatDate(start)} – ${formatDate(addDays(start, 6))}`}
            {" · "}
            <span className="tabular-nums">{formatMinuteLength(claimed)}</span>{" "}
            claimed
            {longestFree > 0 && (
              <>
                {" · longest free stretch "}
                <span className="tabular-nums">
                  {formatMinuteLength(longestFree)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <nav aria-label="View" className="flex gap-1">
            {(["day", "week"] as const).map((option) => (
              <Link
                key={option}
                href={`/calendar?view=${option}&date=${anchorISO}`}
                aria-current={view === option ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring rounded-full px-3 py-1 text-label capitalize transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  view === option
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </Link>
            ))}
          </nav>

          <div className="border-border flex items-center rounded-full border">
            <Button asChild variant="ghost" size="icon" className="rounded-l-full">
              <Link href={hrefFor(addDays(anchor, -step))} aria-label="Previous">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="rounded-none px-3">
              <Link href={hrefFor(today)}>Today</Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="rounded-r-full">
              <Link href={hrefFor(addDays(anchor, step))} aria-label="Next">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <CalendarView
          days={days}
          blocks={blocks}
          todayISO={toISODate(today)}
          timeZone={user.timezone}
          tasks={schedulable.map((task) => ({ id: task.id, title: task.title }))}
        />

        <aside className="space-y-6">
          <section>
            <h2 className="font-display text-title">Not on the day yet</h2>
            <p className="text-muted-foreground mt-0.5 mb-3 text-label">
              Habits due today and everything still open. Drag one onto the
              grid, or press it in and let it find a gap.
            </p>
            <SchedulePanel
              items={schedulable}
              dateISO={anchorISO}
              today={today}
            />
          </section>

          <section className="border-border rounded-lg border border-dashed p-4">
            <h2 className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
              How to use this
            </h2>
            <ul className="text-muted-foreground mt-2 space-y-1.5 text-label">
              <li>Click any empty half hour to block it out.</li>
              <li>
                Drag anything from the list above onto the grid to put it at
                that exact time.
              </li>
              <li>Drag a block to move it, or its bottom edge to resize.</li>
              <li>
                Leave <span className="text-foreground">buffer</span> in. A day
                planned wall to wall is a day you abandon by eleven.
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <p className="text-muted-foreground mt-6 text-label">
        A block is a plan and a session is what happened — the app keeps them
        apart on purpose, so{" "}
        <Link href="/stats" className="hover:text-foreground underline underline-offset-4">
          your stats
        </Link>{" "}
        can tell you the difference.
      </p>
    </div>
  );
}
