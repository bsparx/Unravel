/**
 * Prayer windows — pure logic. No React, no Prisma.
 *
 * Timings come as "minutes since the city's midnight" and every window is:
 *
 *   Fajr    fajr → sunrise
 *   Zuhr    dhuhr → asr − 30
 *   Asr     asr → maghrib − 30
 *   Maghrib maghrib → isha − 30
 *   Isha    isha → fajr(D+1) − 30        (crosses midnight; endMin > 1440)
 *
 * The 30-minute cutoff is the grace each prayer gives the one before it — a
 * window ends when the next prayer's time *minus half an hour* arrives, so
 * the boundary is never mid-prayer.
 */

import { startOfLocalDay } from "@/lib/dates";
import type { PrayerKind } from "@/lib/generated/prisma/client";

export const PRAYERS = ["FAJR", "ZUHR", "ASR", "MAGHRIB", "ISHA"] as const;

export const PRAYER_LABELS: Record<PrayerKind, string> = {
  FAJR: "Fajr",
  ZUHR: "Zuhr",
  ASR: "Asr",
  MAGHRIB: "Maghrib",
  ISHA: "Isha",
};

export const MINUTES_PER_DAY = 1440;
/** Every window ends 30 minutes before the next prayer starts. */
export const CUTOFF_MINUTES = 30;
/** Aladhan reports timings in the city's own wall clock — Pakistan is UTC+5. */
export const CITY_ZONE = "Asia/Karachi";

export type PrayerTimings = {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
};

export type PrayerWindow = {
  prayer: PrayerKind;
  /** Minutes since the owning day's midnight, in the user's timezone. */
  startMin: number;
  /** May exceed 1440 for Isha — it ends after midnight. */
  endMin: number;
};

function toMinutes(value: string): number | null {
  // Aladhan occasionally annotates a time with its zone: "04:36 (PKT)". The
  // clock itself is what matters — a suffix must not sink the whole payload.
  const match = /^(\d{1,2}):(\d{2})(?:\s+\([^)]*\))?$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < MINUTES_PER_DAY ? minutes : null;
}

/**
 * The timings object inside an Aladhan response: `{ timings: { Fajr,
 * Sunrise, ... } }`, keys as the API spells them. Rejects partial or
 * malformed payloads wholesale — a half-parsed schedule would put Fajr in the
 * middle of the night with no error anywhere.
 */
export function parseTimings(payload: unknown): PrayerTimings | null {
  const timings = (payload as { timings?: Record<string, unknown> } | null)
    ?.timings;
  if (!timings) return null;

  const read = (key: string): number | null => {
    const value = timings[key];
    return typeof value === "string" ? toMinutes(value) : null;
  };

  const fajr = read("Fajr");
  const sunrise = read("Sunrise");
  const dhuhr = read("Dhuhr");
  const asr = read("Asr");
  const maghrib = read("Maghrib");
  const isha = read("Isha");

  if (
    fajr === null ||
    sunrise === null ||
    dhuhr === null ||
    asr === null ||
    maghrib === null ||
    isha === null
  ) {
    return null;
  }

  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}

/** Minutes from UTC to wall clock in `timeZone` at `instant`. Positive east. */
export function offsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );

  return Math.round((asUTC - instant.getTime()) / 60_000);
}

/**
 * A timing given as "minutes since the city's midnight on `date`", re-expressed
 * as minutes since the user's local midnight. Identity when zones match, which
 * is the case this app actually serves (Asia/Karachi).
 */
export function shiftToZone(
  minutes: number,
  fromZone: string,
  toZone: string,
  date: Date,
): number {
  if (fromZone === toZone) return minutes;
  const naive = new Date(date.getTime() + minutes * 60_000);
  const instant = new Date(
    naive.getTime() - offsetMinutes(fromZone, naive) * 60_000,
  );
  const shifted =
    (instant.getTime() - startOfLocalDay(toZone, instant).getTime()) / 60_000;
  return Math.round(((shifted % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

/** The five windows of one day. `nextFajr` is the next day's fajr. */
export function prayerWindows(
  timings: PrayerTimings,
  nextFajr: number,
): PrayerWindow[] {
  return [
    { prayer: "FAJR", startMin: timings.fajr, endMin: timings.sunrise },
    {
      prayer: "ZUHR",
      startMin: timings.dhuhr,
      endMin: timings.asr - CUTOFF_MINUTES,
    },
    {
      prayer: "ASR",
      startMin: timings.asr,
      endMin: timings.maghrib - CUTOFF_MINUTES,
    },
    {
      prayer: "MAGHRIB",
      startMin: timings.maghrib,
      endMin: timings.isha - CUTOFF_MINUTES,
    },
    {
      prayer: "ISHA",
      startMin: timings.isha,
      endMin: MINUTES_PER_DAY + nextFajr - CUTOFF_MINUTES,
    },
  ];
}
