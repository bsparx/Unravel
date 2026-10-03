import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/info-tip";
import { requireUser } from "@/lib/auth";
import {
  blockLabel,
  claimedMinutes,
  formatMinuteLength,
  formatMinuteOfDay,
  freeSlots,
} from "@/lib/block-math";
import {
  addDays,
  addMonths,
  formatDate,
  formatFullDate,
  minuteOfDayLocal,
  parseLocalDate,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayLocal,
  WEEKDAYS,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getBlockedDays, getBlocks, getSchedulableItems } from "@/lib/time-blocks";
import { getPrayerBands } from "@/lib/prayers";
import { tightCount, transitionsForDay } from "@/lib/transitions";
import { cn } from "@/lib/utils";

import { CalendarView } from "./_components/calendar-view";
import type { GridDay } from "./_components/calendar-grid";
import { MonthStrip } from "./_components/month-strip";
import { SchedulePanel } from "./_components/schedule-panel";
import { WeekInsights } from "./_components/week-insights";

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

  // Day by default: the rail's "Plan" link is a bare /calendar, and a person
  // arriving here mid-week is planning one day, not seven. Week stays one
  // explicit toggle away and every other link passes its own ?view=.
  const view: View = first("view") === "week" ? "week" : "day";
  const today = todayLocal(user.timezone);
  // A malformed date degrades to today rather than 404ing — this is a URL
  // people will hand-edit.
  const anchor = (first("date") ? parseLocalDate(first("date")!) : null) ?? today;

  const start = view === "week" ? startOfWeek(anchor, user.weekStart) : anchor;
  const length = view === "week" ? 7 : 1;

  // The week the anchor sits in, for "Where the week goes". In week view it is
  // the same read as the grid's, so it is only fetched separately for a day.
  const weekStart = startOfWeek(anchor, user.weekStart);
  const [blocks, weekBlocks, identities, schedulable, blockedDays, prayerBands] = await Promise.all([
    getBlocks(user, start, length),
    view === "week" ? null : getBlocks(user, weekStart, 7),
    prisma.identity.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, colorSlot: true },
    }),
    getSchedulableItems(user, anchor),
    // The mini-month navigator's dots: which days in the anchor's month
    // already carry a block.
    getBlockedDays(
      user,
      startOfMonth(anchor),
      Math.round(
        (addMonths(startOfMonth(anchor), 1).getTime() -
          startOfMonth(anchor).getTime()) /
          86_400_000,
      ),
    ),
    user.prayerRemindersEnabled ? getPrayerBands(user, start, length) : {},
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
  // A daydream is imaginary time — it claims nothing, so every number below
  // reads the day without it. The grid still renders it (see `blocks`).
  const committed = anchorBlocks.filter((block) => block.kind !== "DAYDREAM");
  const claimed = claimedMinutes(committed);
  const open = freeSlots(committed, WAKING_START, WAKING_END);
  const longestFree = open.reduce(
    (best, slot) => Math.max(best, slot.endMinute - slot.startMinute),
    0,
  );

  // The day's give. `claimed` says how much is spoken for and `longestFree` how
  // much room is left to work in; neither says anything about the switches
  // between, which is where a day with no slack actually comes apart.
  const switches = transitionsForDay(
    committed.map((block) => ({
      id: block.id,
      title: block.title,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      cueForId: block.cueForId,
      hasCue: block.hasCue,
    })),
  );
  const tight = tightCount(switches);

  // The day, read as one sentence. Numbers as prose: a felt sense of duration
  // is exactly what this audience doesn't have, so "Next up: X at 15:00 · 55
  // minutes open before it" does the arithmetic they'd otherwise have to.
  const nowMinute = minuteOfDayLocal(user.timezone);
  const anchorIsToday = anchor.getTime() === today.getTime();
  const nextUp = anchorIsToday
    ? committed
        // `>=`: a block starting at the exact current minute is next up, not
        // behind you.
        .filter((block) => block.startMinute >= nowMinute)
        .sort((a, b) => a.startMinute - b.startMinute)[0]
    : undefined;

  const headline = (() => {
    if (nextUp) {
      const open = nextUp.startMinute - nowMinute;
      return (
        <>
          Next up:{" "}
          <span className="text-foreground font-medium">
            {blockLabel(nextUp)}
          </span>{" "}
          at{" "}
          <span className="tabular-nums">{formatMinuteOfDay(nextUp.startMinute)}</span>
          {open > 0 && (
            <>
              {" · "}
              <span className="tabular-nums">{formatMinuteLength(open)}</span>{" "}
              open before it
            </>
          )}
          .
        </>
      );
    }
    if (anchorIsToday) {
      return committed.length > 0
        ? "All planned time is behind you."
        : "Nothing planned yet. Choose a time to add a block.";
    }
    if (committed.length === 0) return "Nothing planned yet.";
    return (
      <>
        <span className="tabular-nums">{formatMinuteLength(claimed)}</span> planned
        across {committed.length} block{committed.length === 1 ? "" : "s"}
        {longestFree > 0 && (
          <>
            {" · longest open stretch "}
            <span className="tabular-nums">{formatMinuteLength(longestFree)}</span>
          </>
        )}
        .
      </>
    );
  })();

  return (
    <div className="w-full px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display">
            Calendar <InfoTip term="blocks" className="ml-1" />
          </h1>
          <p className="text-muted-foreground mt-1 text-label">
            {view === "day"
              ? formatFullDate(anchor)
              : `${formatDate(start)} - ${formatDate(addDays(start, 6))}`}
          </p>
          <p className="text-muted-foreground mt-0.5 text-label">{headline}</p>
          {/* Only when there is something to say. A day with room to switch in
              needs no comment on the fact — the strips on the grid already
              carry it, and a permanent counter reading "0 tight" would just be
              one more number to scan past. */}
          {tight > 0 && (
            <p className="text-destructive mt-1 text-label">
              {tight === 1
                ? "One switch today has no room in it."
                : `${tight} switches today have no room in them.`}{" "}
              <span className="text-muted-foreground">
                Nudge one of the blocks and the gap opens up.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="View" className="bg-secondary/50 flex gap-1 rounded-[13px] p-1">
            {(["day", "week"] as const).map((option) => (
              <Link
                key={option}
                href={`/calendar?view=${option}&date=${anchorISO}`}
                aria-current={view === option ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-11 min-w-14 items-center justify-center rounded-[10px] px-3 py-2 text-label capitalize transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  view === option
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </Link>
            ))}
          </nav>

          <div className="border-border flex items-center rounded-[13px] border p-1">
            <Button asChild variant="ghost" size="icon" className="size-11 rounded-[10px]">
              <Link href={hrefFor(addDays(anchor, -step))} aria-label={`Previous ${view}`}>
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="min-h-11 rounded-[10px] px-3">
              <Link href={hrefFor(today)}>Today</Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-11 rounded-[10px]">
              <Link href={hrefFor(addDays(anchor, step))} aria-label={`Next ${view}`}>
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
          prayerBands={prayerBands}
          todayISO={toISODate(today)}
          anchorISO={anchorISO}
          timeZone={user.timezone}
          tasks={schedulable.map((task) => ({
            id: task.id,
            title: task.title,
            cueTitle: task.cueTitle,
            color: task.color,
          }))}
          identities={identities}
        />

        <aside className="space-y-6">
          <MonthStrip
            month={startOfMonth(anchor)}
            anchor={anchor}
            weekStart={user.weekStart}
            timeZone={user.timezone}
            blockedDays={blockedDays}
          />
          <section>
            <h2 className="font-heading text-lg font-semibold">
              Not on the day yet
              {schedulable.length > 0 && (
                <span className="text-muted-foreground font-sans text-label">
                  {" · "}
                  <span className="tabular-nums">{schedulable.length}</span> left
                </span>
              )}
            </h2>
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
        </aside>
      </div>

      <WeekInsights
        blocks={weekBlocks ?? blocks}
        identities={identities}
        rangeLabel={`${formatDate(weekStart)} - ${formatDate(addDays(weekStart, 6))}`}
      />

      <p className="text-muted-foreground mt-6 text-label">
        Blocks show planned time. Sessions show what happened, so{" "}
        <Link href="/stats" className="hover:text-foreground underline underline-offset-4">
          your stats
        </Link>{" "}
        can tell you the difference.
      </p>
    </div>
  );
}
