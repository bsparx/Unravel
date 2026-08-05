import { requireUser } from "@/lib/auth";
import { formatFullDate, minuteOfDayLocal, todayLocal } from "@/lib/dates";
import { getWaterDay } from "@/lib/water-data";

import { DayGlasses } from "./_components/day-glasses";
import { WaterSettingsForm } from "./_components/water-settings-form";
import { WaterVessel } from "./_components/water-vessel";

export const metadata = { title: "Water" };

/**
 * The day as a column of water: one tap on the vessel logs a glass, the level
 * rises, and the count is the only number worth looking at. Editing and the
 * reminder schedule live below in quiet cards, so the top of the page stays
 * exactly one action wide.
 */
export default async function WaterPage() {
  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const day = await getWaterDay(user, today);
  const nowMinute = minuteOfDayLocal(user.timezone);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          {formatFullDate(today)}
        </p>
        <h1 className="text-display mt-1">Water</h1>
        {day.streak > 0 && (
          <p className="text-muted-foreground mt-2 text-label">
            <span className="text-foreground tabular-nums">{day.streak}</span>{" "}
            day{day.streak === 1 ? "" : "s"} on goal
          </p>
        )}
      </header>

      <div className="mb-10">
        <WaterVessel
          dateISO={day.dateISO}
          settings={day.settings}
          glasses={day.count}
          lastTimeMin={day.lastTimeMin}
          initialNowMinute={nowMinute}
          timezone={user.timezone}
        />
      </div>

      <div className="space-y-4">
        <DayGlasses
          dateISO={day.dateISO}
          glasses={day.glasses}
          settings={day.settings}
          initialNowMinute={nowMinute}
        />
        <WaterSettingsForm values={day.settings} />
      </div>
    </div>
  );
}
