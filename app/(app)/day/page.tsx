import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import {
  formatDuration,
  formatFullDate,
  minuteOfDayLocal,
  toISODate,
} from "@/lib/dates";
import { getPrayerCycle } from "@/lib/prayers";
import { getTodayView, startHereHabit } from "@/lib/tasks";
import { getBlocks } from "@/lib/time-blocks";
import { getWaterToday } from "@/lib/water-data";

import { DayList } from "./_components/day-list";
import { DayRail } from "./_components/day-rail";
import { PrayerSection } from "./_components/prayer-section";
import { StartHere } from "./_components/start-here";

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

      {/* One obvious next action, then the day's shape. Everything below is
          optional. */}
      {upNext && (
        <StartHere item={upNext} timezone={user.timezone} />
      )}

      <DayRail
        blocks={plannedBlocks}
        dateISO={todayISO}
        upNextMinute={upNext?.timeAnchorMinutes ?? null}
        timezone={user.timezone}
      />

      {user.prayerRemindersEnabled && <PrayerSection view={prayers} />}

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
