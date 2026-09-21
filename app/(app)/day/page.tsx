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
import { getTodayView } from "@/lib/tasks";
import { getBlocks } from "@/lib/time-blocks";
import { getWaterToday } from "@/lib/water-data";

import { DayList } from "./_components/day-list";
import { PrayerSection } from "./_components/prayer-section";
import { QuestHero } from "./_components/quest-hero";
import { QuestLog } from "./_components/quest-log";

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

      {/* One obvious quest, then the day's shape. Everything below is
          optional. The hero reads the calendar's blocks and the anchored
          habits as one timeline: in progress, about to unlock, or available
          right now. */}
      <QuestHero
        blocks={plannedBlocks}
        habits={view.habits}
        available={{
          overdue: view.overdue,
          dueToday: view.dueToday,
          undated: view.undated,
          unanchored: view.habits.filter(
            (habit) => habit.timeAnchorMinutes === null,
          ),
          completedCount: view.completedToday.length,
        }}
        serverNowMinute={minuteOfDayLocal(user.timezone)}
        timezone={user.timezone}
        dateISO={todayISO}
      />

      <QuestLog
        blocks={plannedBlocks}
        habits={view.habits}
        serverNowMinute={minuteOfDayLocal(user.timezone)}
        timezone={user.timezone}
        dateISO={todayISO}
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
