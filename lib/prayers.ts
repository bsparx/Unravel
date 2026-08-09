/**
 * Prayer windows for the day and the calendar — reads, fetches and shaping.
 * The window arithmetic lives in `lib/prayer-math.ts`; this file only talks
 * to the database and the Aladhan API.
 *
 * Timings come from Aladhan (method 1 — University of Karachi, the standard
 * calculation for Pakistan) and are cached in `PrayerDayTimes`, one row per
 * (city, date). Fetching goes through the month endpoint, so the API is hit
 * at most once per month per city; the daily cron prunes the cache so rows
 * are refreshed as they age out.
 *
 * A "cycle" is the set of five prayers for one local day. The cycle currently
 * in progress is the one whose Isha window is still open — at 2 AM that is
 * still yesterday's cycle, which is why the day view needs D−1, D and D+1.
 */

import { prisma } from "@/lib/db";
import {
  addDays,
  eachDateInRange,
  minuteOfDayLocal,
  toISODate,
  todayLocal,
} from "@/lib/dates";
import type { PrayerKind, User } from "@/lib/generated/prisma/client";
import {
  CITY_ZONE,
  CUTOFF_MINUTES,
  MINUTES_PER_DAY,
  PRAYER_LABELS,
  parseTimings,
  prayerWindows,
  shiftToZone,
  type PrayerTimings,
  type PrayerWindow,
} from "@/lib/prayer-math";

export {
  PRAYERS,
  PRAYER_LABELS,
  MINUTES_PER_DAY,
  type PrayerTimings,
  type PrayerWindow,
} from "@/lib/prayer-math";

export const DEFAULT_CITY = "Karachi";

export type PrayerItem = PrayerWindow & {
  label: string;
  status: "done" | "active" | "upcoming" | "missed";
  checkedAt: Date | null;
};

/** One tinted band on one calendar column, clipped to the day. */
export type PrayerBand = {
  prayer: PrayerKind;
  label: string;
  startMin: number;
  endMin: number;
  /** The day the prayer belongs to — the check button writes against this. */
  ownerISO: string;
  checked: boolean;
  /** Yesterday's Isha, still running into this morning. No check button. */
  continuation: boolean;
};

const API = "https://api.aladhan.com/v1";
const METHOD = 1;
/**
 * HANAFI Asr (shadow = 2× object) — the standard calculation for Pakistan.
 * Aladhan defaults to STANDARD/Shafi, which lands Asr ~70 minutes early
 * (16:06 vs the correct 17:16 on 2026-08-09 in Karachi).
 */
const SCHOOL = 1;

/** Where the single-day and month endpoints agree Karachi sits. */
const KARACHI_COORDS = { latitude: 24.86, longitude: 67.01 };

/** Geocoded once per process per city — see resolveCityCoords. */
const COORDS_CACHE = new Map<string, { latitude: number; longitude: number }>();

/**
 * City name → coordinates, via OpenStreetMap's Nominatim. Called once per
 * city per process (the cache never expires) and never on the hot path: the
 * per-day Aladhan data is served from PrayerDayTimes, and the geocode result
 * only changes when the city itself does. A lookup failure degrades to
 * Karachi's coordinates — the app's default city — rather than blocking the
 * day.
 */
async function resolveCityCoords(
  city: string,
): Promise<{ latitude: number; longitude: number }> {
  const cached = COORDS_CACHE.get(city);
  if (cached) return cached;

  const fallback = KARACHI_COORDS;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pk&q=${encodeURIComponent(city)}`,
      {
        headers: {
          // Nominatim's policy: identify the calling application.
          "User-Agent": "unravel-productivity/0.1 (personal planner)",
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      COORDS_CACHE.set(city, fallback);
      return fallback;
    }

    const results = (await response.json()) as {
      lat?: string;
      lon?: string;
    }[];
    const first = results[0];
    const latitude = first?.lat ? Number(first.lat) : NaN;
    const longitude = first?.lon ? Number(first.lon) : NaN;
    const resolved =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : fallback;

    COORDS_CACHE.set(city, resolved);
    return resolved;
  } catch {
    COORDS_CACHE.set(city, fallback);
    return fallback;
  }
}

function minutesFromDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function toZoneTimings(
  timings: PrayerTimings,
  date: Date,
  timeZone: string,
): PrayerTimings {
  const shift = (minutes: number) =>
    shiftToZone(minutes, CITY_ZONE, timeZone, date);
  return {
    fajr: shift(timings.fajr),
    sunrise: shift(timings.sunrise),
    dhuhr: shift(timings.dhuhr),
    asr: shift(timings.asr),
    maghrib: shift(timings.maghrib),
    isha: shift(timings.isha),
  };
}

async function fetchMonth(
  city: string,
  year: number,
  month: number,
): Promise<Map<string, PrayerTimings> | null> {
  const { latitude, longitude } = await resolveCityCoords(city);
  const url = `${API}/calendar?latitude=${latitude}&longitude=${longitude}&month=${String(month).padStart(2, "0")}&year=${year}&method=${METHOD}&school=${SCHOOL}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as {
      data?: { timings?: unknown; date?: { gregorian?: { date?: string } } }[];
    };
    if (!Array.isArray(json.data)) return null;

    const found = new Map<string, PrayerTimings>();
    for (const item of json.data) {
      const iso = minutesFromDate(item?.date?.gregorian?.date ?? "");
      const timings = parseTimings(item);
      if (iso && timings) found.set(iso, timings);
    }
    return found.size > 0 ? found : null;
  } catch {
    return null;
  }
}

/**
 * Timings for every requested date, keyed by ISO. Fetches only the dates not
 * already cached, one month call per missing month, and falls back to the most
 * recent cached timings if the API is unreachable. Never throws — an empty
 * map means "API down and nothing cached", which callers render as a quiet
 * "unavailable" rather than an error.
 */
export async function getTimingsForDates(
  city: string,
  dates: Date[],
): Promise<Map<string, PrayerTimings>> {
  const result = new Map<string, PrayerTimings>();

  const rows = await prisma.prayerDayTimes.findMany({
    where: { city, date: { in: dates } },
  });
  for (const row of rows) {
    const parsed = parseTimings(row.timings);
    if (parsed) result.set(toISODate(row.date), parsed);
  }

  const missing = dates.filter((date) => !result.has(toISODate(date)));
  if (missing.length === 0) return result;

  const months = new Map<string, Date[]>();
  for (const date of missing) {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
    months.set(key, [...(months.get(key) ?? []), date]);
  }

  for (const [key, monthDates] of months) {
    const [year, month] = key.split("-").map(Number);
    const fetched = await fetchMonth(city, year, month);
    if (!fetched) continue;

    const toPersist = [...fetched]
      .filter(([iso]) => monthDates.some((d) => toISODate(d) === iso))
      .map(([date, timings]) => ({
        city,
        date: new Date(`${date}T00:00:00.000Z`),
        timings: timings as unknown as object,
      }));

    if (toPersist.length > 0) {
      await prisma.prayerDayTimes.createMany({
        data: toPersist,
        skipDuplicates: true,
      });
    }

    for (const [iso, timings] of fetched) {
      if (monthDates.some((d) => toISODate(d) === iso)) {
        result.set(iso, timings);
      }
    }
  }

  // API unreachable: degrade to the most recent cached timings for the city.
  const stillMissing = dates.filter((date) => !result.has(toISODate(date)));
  if (stillMissing.length > 0) {
    const fallback = await prisma.prayerDayTimes.findFirst({
      where: {
        city,
        date: { lte: stillMissing[0] },
      },
      orderBy: { date: "desc" },
    });
    if (fallback) {
      const parsed = parseTimings(fallback.timings);
      if (parsed) {
        for (const date of stillMissing) result.set(toISODate(date), parsed);
      }
    }
  }

  return result;
}

export type PrayerCycleView = {
  city: string;
  /** The local day the cycle belongs to (yesterday when Isha is still open). */
  date: Date;
  dateISO: string;
  nowMin: number;
  items: PrayerItem[];
};

/**
 * The prayer cycle currently in progress for the user, or null when timings
 * are unavailable. The cycle flips to the next day once 30 minutes before
 * that day's Fajr — the moment Isha's window closes.
 */
export async function getPrayerCycle(
  user: User,
  now: Date = new Date(),
): Promise<PrayerCycleView | null> {
  const timeZone = user.timezone;
  const city = (user.prayerCity ?? "").trim() || DEFAULT_CITY;
  const today = todayLocal(timeZone, now);
  const dates = [addDays(today, -1), today, addDays(today, 1)];
  const times = await getTimingsForDates(city, dates);

  const todayTimings = times.get(toISODate(today));
  if (!todayTimings) return null;

  const todayInZone = toZoneTimings(todayTimings, today, timeZone);
  const nowMinLocal = minuteOfDayLocal(timeZone, now);

  const cycle =
    nowMinLocal < todayInZone.fajr - CUTOFF_MINUTES
      ? addDays(today, -1)
      : today;
  const cycleISO = toISODate(cycle);
  const cycleTimings = times.get(cycleISO);
  if (!cycleTimings) return null;

  // The windows are in cycle-day coordinates — for a cycle that belongs to
  // yesterday (Isha still open after midnight), "now" is 1440 minutes on.
  // Without this, 4 AM reads as "before the window" instead of "inside Isha".
  const nowMin =
    nowMinLocal + (cycle.getTime() === today.getTime() ? 0 : MINUTES_PER_DAY);

  const next = times.get(toISODate(addDays(cycle, 1)));
  const nextFajr = next
    ? toZoneTimings(next, addDays(cycle, 1), timeZone).fajr
    : toZoneTimings(cycleTimings, cycle, timeZone).fajr;

  const windows = prayerWindows(
    toZoneTimings(cycleTimings, cycle, timeZone),
    nextFajr,
  );

  const checks = await prisma.prayerCheck.findMany({
    where: { userId: user.id, date: cycle },
  });
  const checkedByPrayer = new Map<PrayerKind, Date>(
    checks.map((check) => [check.prayer, check.checkedAt]),
  );

  const items: PrayerItem[] = windows.map((window) => {
    const checkedAt = checkedByPrayer.get(window.prayer) ?? null;
    const status = checkedAt
      ? "done"
      : nowMin < window.startMin
        ? "upcoming"
        : nowMin < window.endMin
          ? "active"
          : "missed";
    return {
      ...window,
      label: PRAYER_LABELS[window.prayer],
      status,
      checkedAt,
    };
  });

  return { city, date: cycle, dateISO: cycleISO, nowMin, items };
}

/**
 * The tinted bands for each day in `[start, start + days)`, keyed by ISO date.
 * Each day's bands are its own five windows (Isha clipped at midnight) plus
 * the overnight continuation of yesterday's Isha in the early morning.
 */
export async function getPrayerBands(
  user: User,
  start: Date,
  days: number,
): Promise<Record<string, PrayerBand[]>> {
  const timeZone = user.timezone;
  const city = (user.prayerCity ?? "").trim() || DEFAULT_CITY;
  const dates = eachDateInRange(start, addDays(start, days - 1));
  const times = await getTimingsForDates(city, dates);
  if (times.size === 0) return {};

  const checks = await prisma.prayerCheck.findMany({
    where: { userId: user.id, date: { in: dates } },
  });
  const checkedKeys = new Set(
    checks.map((check) => `${toISODate(check.date)}|${check.prayer}`),
  );

  const byISO: Record<string, PrayerBand[]> = {};

  for (const date of dates) {
    const iso = toISODate(date);
    const timings = times.get(iso);
    if (!timings) continue;

    const inZone = toZoneTimings(timings, date, timeZone);
    const next = times.get(toISODate(addDays(date, 1)));
    const nextFajr = next
      ? toZoneTimings(next, addDays(date, 1), timeZone).fajr
      : inZone.fajr;

    const bands: PrayerBand[] = [];

    for (const window of prayerWindows(inZone, nextFajr)) {
      const endMin = Math.min(window.endMin, MINUTES_PER_DAY);
      if (endMin <= window.startMin) continue;
      bands.push({
        prayer: window.prayer,
        label: PRAYER_LABELS[window.prayer],
        startMin: window.startMin,
        endMin,
        ownerISO: iso,
        checked: checkedKeys.has(`${iso}|${window.prayer}`),
        continuation: false,
      });
    }

    const prevISO = toISODate(addDays(date, -1));
    const prev = times.get(prevISO);
    if (prev) {
      const prevInZone = toZoneTimings(prev, addDays(date, -1), timeZone);
      const contEnd = inZone.fajr - CUTOFF_MINUTES;
      if (contEnd > 0 && contEnd > prevInZone.isha % MINUTES_PER_DAY) {
        bands.push({
          prayer: "ISHA",
          label: PRAYER_LABELS.ISHA,
          startMin: 0,
          endMin: contEnd,
          ownerISO: prevISO,
          checked: checkedKeys.has(`${prevISO}|ISHA`),
          continuation: true,
        });
      }
    }

    bands.sort((a, b) => a.startMin - b.startMin);
    byISO[iso] = bands;
  }

  return byISO;
}
