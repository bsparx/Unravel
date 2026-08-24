import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { formatMinuteOfDay } from "@/lib/block-math";
import {
  formatDuration,
  formatFullDate,
  minuteOfDayLocal,
  toISODate,
} from "@/lib/dates";
import { getPrayerCycle } from "@/lib/prayers";
import { getTodayView, startHereHabit } from "@/lib/tasks";
import { buildTimerHref } from "@/lib/timer-url";
import { getBlocks } from "@/lib/time-blocks";
import { getWaterToday } from "@/lib/water-data";

import { DayList } from "./_components/day-list";
import { PlanStrip } from "./_components/plan-strip";
import { PrayerSection } from "./_components/prayer-section";

export const metadata = { title: "Your day" };

export default async function TodayPage() {
  const user = await requireUser();
  const view = await getTodayView(user);
  const blocks = await getBlocks(user, view.date, 1);
  // Daydream blocks live on /calendar only — /day never sees them.
  const plannedBlocks = blocks.filter((block) => block.kind !== "DAYDREAM");
  const water = await getWaterToday(user, view.date);
  const todayISO = toISODate(view.date);

  const prayers = user.prayerRemindersEnabled ? await getPrayerCycle(user) : null;

  const nowMinute = minuteOfDayLocal(user.timezone);

  // Time-aware: the habit whose moment it is, else the old chain of fallbacks.
  const upNext =
    startHereHabit(view.habits, nowMinute) ??
    view.overdue[0] ??
    view.dueToday[0] ??
    view.undated[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          {formatFullDate(view.date)}
        </p>
        <h1 className="text-display mt-1">Today</h1>

        <p className="text-muted-foreground mt-2 text-label">
          {view.plannedSeconds > 0 ? (
            <>
              <span className="text-foreground tabular-nums">
                {formatDuration(view.plannedSeconds)}
              </span>{" "}
              planned
            </>
          ) : (
            "Nothing planned yet"
          )}
          {view.loggedSeconds > 0 && (
            <>
              {" · "}
              <span className="text-running tabular-nums">
                {formatDuration(view.loggedSeconds)}
              </span>{" "}
              on the clock
            </>
          )}
        </p>
      </header>

      <div className="mb-6">
        <PlanStrip
          blocks={plannedBlocks}
          dateISO={todayISO}
          nowMinute={nowMinute}
        />
      </div>

      {user.prayerRemindersEnabled && <PrayerSection view={prayers} />}

      {upNext && (
        // One obvious next action. Everything below is optional.
        <Link
          href={buildTimerHref({
            id: upNext.id,
            estimatedSeconds: upNext.estimatedSeconds,
            defaultMode: upNext.defaultMode,
            plannedIntervals: upNext.plannedIntervals,
          })}
          className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring group mb-8 flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <div className="min-w-0">
            <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
              Start here
              {upNext.timeAnchorMinutes !== null && (
                <span className="text-primary ml-2 normal-case">
                  · {formatMinuteOfDay(upNext.timeAnchorMinutes)}
                </span>
              )}
            </p>
            <p className="font-display mt-0.5 truncate text-title">
              {upNext.title}
            </p>
          </div>
          <span className="text-primary shrink-0 text-label font-medium">
            Set a timer →
          </span>
        </Link>
      )}

      <DayList
        view={view}
        todayISO={todayISO}
        water={water}
        timezone={user.timezone}
      />

      <div className="border-border mt-10 flex flex-wrap justify-center gap-2 border-t pt-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tasks/new">
            <Plus className="size-4" aria-hidden />
            Add with details
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/calendar?view=day&date=${todayISO}`}>
            <CalendarDays className="size-4" aria-hidden />
            Give it all a time
          </Link>
        </Button>
      </div>
    </div>
  );
}
