/**
 * Intermittent fasting, as pure arithmetic.
 *
 * The plan is one eating window a day, in minutes of the local day. A window
 * may run past midnight (eat 18:00-02:00). The fast is the rest of the day.
 * Real fasts are logged as instants elsewhere; this file only knows how to
 * read them against the plan. No streaks and no "broken" fasts: a short fast
 * is just a shorter fast.
 */

import { addDays, toISODate, toLocalDate } from "@/lib/dates";

export const MINUTES_PER_DAY = 1440;
/** Longer than this isn't something the log is for. */
export const MAX_FAST_MINUTES = 72 * 60;
/** Clocks drift; a fast may end up to this far "in the future". */
const FUTURE_GRACE_MS = 5 * 60_000;

export type FastWindow = { eatStart: number; eatEnd: number };

export type FastProtocolId = "14-10" | "16-8" | "18-6" | "20-4" | "omad" | "custom";

export type FastProtocol = {
  id: Exclude<FastProtocolId, "custom">;
  label: string;
  name: string;
  eatHours: number;
  blurb: string;
};

export const FAST_PROTOCOLS: readonly FastProtocol[] = [
  {
    id: "14-10",
    label: "14:10",
    name: "Gentle",
    eatHours: 10,
    blurb: "A long night plus a late breakfast or an early dinner. A good way in.",
  },
  {
    id: "16-8",
    label: "16:8",
    name: "Classic",
    eatHours: 8,
    blurb: "The usual one: skip breakfast, eat across the afternoon and evening.",
  },
  {
    id: "18-6",
    label: "18:6",
    name: "Longer",
    eatHours: 6,
    blurb: "Two meals close together, a longer stretch without.",
  },
  {
    id: "20-4",
    label: "20:4",
    name: "Warrior",
    eatHours: 4,
    blurb: "A four-hour window, usually in the evening.",
  },
  {
    id: "omad",
    label: "OMAD",
    name: "One meal",
    eatHours: 1,
    blurb: "One meal a day, an hour to eat it.",
  },
];

export const DEFAULT_FAST_WINDOW: FastWindow = { eatStart: 12 * 60, eatEnd: 20 * 60 };

const mod = (n: number) => ((n % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

export function isMinuteOfDay(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY;
}

/** A window read off the User row, mended if it's somehow out of range. */
export function normalizeWindow(eatStart: number, eatEnd: number): FastWindow {
  if (!isMinuteOfDay(eatStart) || !isMinuteOfDay(eatEnd) || eatStart === eatEnd) {
    return DEFAULT_FAST_WINDOW;
  }
  return { eatStart, eatEnd };
}

/** How long the window is open. Wraps past midnight. */
export function eatMinutes(window: FastWindow): number {
  return mod(window.eatEnd - window.eatStart);
}

/** The planned fast: the rest of the day. */
export function fastMinutes(window: FastWindow): number {
  return MINUTES_PER_DAY - eatMinutes(window);
}

export function findProtocol(id: string): FastProtocol | null {
  return FAST_PROTOCOLS.find((protocol) => protocol.id === id) ?? null;
}

/** A protocol's window, opening at `eatStart`. */
export function windowFor(protocol: FastProtocol, eatStart: number): FastWindow {
  return { eatStart: mod(eatStart), eatEnd: mod(eatStart + protocol.eatHours * 60) };
}

/** Which protocol a window is, or custom. */
export function protocolOf(window: FastWindow): FastProtocolId {
  const minutes = eatMinutes(window);
  return FAST_PROTOCOLS.find((protocol) => protocol.eatHours * 60 === minutes)?.id ?? "custom";
}

/** "16:8", or "15:9" for a custom window that lands on the hour. */
export function windowRatio(window: FastWindow): string {
  const id = protocolOf(window);
  if (id === "omad") return "OMAD";
  const fast = fastMinutes(window);
  const eat = eatMinutes(window);
  const hours = (minutes: number) =>
    minutes % 60 === 0 ? String(minutes / 60) : (minutes / 60).toFixed(1).replace(/\.0$/, "");
  return `${hours(fast)}:${hours(eat)}`;
}

export type Phase = {
  phase: "eating" | "fasting";
  /** Minute of day the phase changes. */
  changesAt: number;
  /** Minutes until it does (1..1440). */
  minutesLeft: number;
};

/** Where the plan says you are at a minute of the day. */
export function phaseAt(minuteOfDay: number, window: FastWindow): Phase {
  const sinceOpen = mod(minuteOfDay - window.eatStart);
  const open = eatMinutes(window);
  if (sinceOpen < open) {
    return { phase: "eating", changesAt: window.eatEnd, minutesLeft: open - sinceOpen };
  }
  return {
    phase: "fasting",
    changesAt: window.eatStart,
    minutesLeft: mod(window.eatStart - minuteOfDay) || MINUTES_PER_DAY,
  };
}

export type FastProgress = {
  elapsedMinutes: number;
  /** 0..1 and beyond: a fast can run past its goal. */
  ratio: number;
  reached: boolean;
  goalAt: Date;
};

export function fastProgress(startedAt: Date, now: Date, targetMinutes: number): FastProgress {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
  const target = Math.max(1, targetMinutes);
  return {
    elapsedMinutes,
    ratio: elapsedMinutes / target,
    reached: elapsedMinutes >= target,
    goalAt: new Date(startedAt.getTime() + target * 60_000),
  };
}

export type FastSpan = { id: string; startedAt: Date; endedAt: Date | null };

/**
 * Why a fast's times can't be saved, or null if they can. `others` are the
 * user's other fasts; an open one runs until now and on.
 */
export function validateFastTimes(
  startedAt: Date,
  endedAt: Date | null,
  now: Date,
  others: readonly FastSpan[],
): string | null {
  const latest = now.getTime() + FUTURE_GRACE_MS;
  if (startedAt.getTime() > latest) return "A fast can't start in the future.";
  if (endedAt) {
    if (endedAt.getTime() <= startedAt.getTime()) return "The end has to come after the start.";
    if (endedAt.getTime() > latest) return "The end can't be in the future.";
  }
  const end = (endedAt ?? now).getTime();
  if (end - startedAt.getTime() > MAX_FAST_MINUTES * 60_000) {
    return "That's longer than 72 hours. Check the dates.";
  }

  const thisEnd = endedAt ? endedAt.getTime() : Number.POSITIVE_INFINITY;
  const clash = others.some((other) => {
    const otherEnd = other.endedAt ? other.endedAt.getTime() : Number.POSITIVE_INFINITY;
    return other.startedAt.getTime() < thisEnd && otherEnd > startedAt.getTime();
  });
  return clash ? "That overlaps another fast." : null;
}

export type FastDay = {
  dateISO: string;
  /** Minutes fasted by fasts that ended this day (an open one counts today). */
  minutes: number;
  /** The goal of the longest of them; null on a day with none. */
  targetMinutes: number | null;
  reached: boolean;
};

/**
 * The last `count` local days, oldest first. Each fast counts toward the day
 * it ended on: a fast from Sunday evening to Monday noon is Monday's.
 */
export function dailyTotals(
  fasts: readonly (FastSpan & { targetMinutes: number })[],
  today: Date,
  count: number,
  timeZone: string,
  now: Date,
): FastDay[] {
  const byDay = new Map<string, { minutes: number; target: number; reached: boolean }>();
  for (const fast of fasts) {
    const end = fast.endedAt ?? now;
    const key = toISODate(toLocalDate(end, timeZone));
    const minutes = Math.max(0, Math.floor((end.getTime() - fast.startedAt.getTime()) / 60_000));
    const entry = byDay.get(key) ?? { minutes: 0, target: 0, reached: false };
    entry.minutes += minutes;
    entry.target = Math.max(entry.target, fast.targetMinutes);
    entry.reached ||= minutes >= fast.targetMinutes;
    byDay.set(key, entry);
  }

  return Array.from({ length: count }, (_, index) => {
    const dateISO = toISODate(addDays(today, index - count + 1));
    const entry = byDay.get(dateISO);
    return {
      dateISO,
      minutes: entry?.minutes ?? 0,
      targetMinutes: entry ? entry.target : null,
      reached: entry?.reached ?? false,
    };
  });
}

// ---------------------------------------------------------------- Islamic fasting

export type FastKindId = "INTERMITTENT" | "ISLAMIC";

export const FAST_KINDS: readonly { id: FastKindId; label: string; blurb: string }[] = [
  {
    id: "INTERMITTENT",
    label: "Intermittent",
    blurb: "One eating window a day, by the clock: 16:8, 18:6 and the like.",
  },
  {
    id: "ISLAMIC",
    label: "Islamic",
    blurb: "Sawm: from Fajr to Maghrib, with the times from your prayer city. The length moves with the seasons.",
  },
];

/** One day's fast by the prayer times: Fajr to Maghrib, as instants. */
export type IslamicDay = { dateISO: string; fajr: Date; maghrib: Date };

/**
 * The day an instant's fast belongs to: the first day (ascending) whose
 * Maghrib is still ahead of it. Before Maghrib that's today; after it, the
 * fast to come is tomorrow's.
 */
export function islamicDayFor(instant: Date, days: readonly IslamicDay[]): IslamicDay | null {
  return days.find((day) => day.maghrib.getTime() > instant.getTime()) ?? null;
}

/** Fajr to Maghrib, in minutes. */
export function islamicMinutes(day: IslamicDay): number {
  return Math.max(1, Math.round((day.maghrib.getTime() - day.fajr.getTime()) / 60_000));
}

/**
 * The day as the strip draws it: eating from Maghrib to the next Fajr, so the
 * fast is the daylight between. Both are minutes of the local day.
 */
export function islamicWindow(fajrMinute: number, maghribMinute: number): FastWindow {
  return { eatStart: mod(maghribMinute), eatEnd: mod(fajrMinute) };
}

/** The strip's window for a day given as instants: eat Maghrib to Fajr. */
export function islamicStripWindow(fajr: Date, maghrib: Date, timeZone: string): FastWindow {
  const minute = (instant: Date) => {
    const [h, m] = formatClockIn(instant, timeZone).split(":").map(Number);
    return h * 60 + m;
  };
  return islamicWindow(minute(fajr), minute(maghrib));
}

/**
 * When "Break fast" ends an Islamic fast: now, if it's broken before Maghrib
 * (illness, travel); Maghrib itself once it has come, so iftar logged late
 * still reads as the fast it was.
 */
export function islamicEnd(now: Date, maghrib: Date): Date {
  return now.getTime() < maghrib.getTime() ? now : maghrib;
}

// ---------------------------------------------------------------- formatting

/** 1230 -> "20:30". */
export function formatMinuteOfDay(minute: number): string {
  const m = mod(minute);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "20:30" -> 1230, or null. */
export function parseMinuteOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 552 -> "9h 12m"; 960 -> "16h"; 45 -> "45m". */
export function formatHM(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** An instant's wall-clock time in `timeZone`, "20:14". */
export function formatClockIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

/** "Mon 17 Nov", in `timeZone`. */
export function formatDayIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(instant);
}
