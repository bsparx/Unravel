"use client";

import { useWaterReminder } from "@/app/(app)/water/_hooks/use-water-reminder";
import type { WaterToday } from "@/lib/water-data";

/**
 * Renders nothing; carries the water reminder across every authed surface.
 *
 * Mounted once in `AuthedProviders` because the reminder's whole point is to
 * reach you wherever you drifted off to — a tab on /water is the one place a
 * reminder is redundant.
 */
export function WaterReminder({
  today,
  timezone,
}: {
  today: WaterToday;
  timezone: string;
}) {
  useWaterReminder({
    settings: today.settings,
    dateISO: today.dateISO,
    glasses: today.count,
    lastTimeMin: today.lastTimeMin,
    timezone,
  });

  return null;
}
