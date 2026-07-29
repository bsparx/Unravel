/**
 * Timezone-aware calendar-day handling.
 *
 * The rule this whole app follows: a "day" the user perceives is resolved
 * exactly once, server-side, in their `User.timezone`, and then stored as a
 * UTC-midnight `DATE`. Nothing downstream ever re-buckets a timestamp — that
 * is where DST and travel bugs come from.
 *
 * A `LocalDate` in this file always means a `Date` sitting at 00:00:00.000Z.
 * Arithmetic on those is exact, because UTC has no DST.
 */

const MS_PER_DAY = 86_400_000;

/** 0 = Sunday .. 6 = Saturday. Matches `Date.prototype.getUTCDay`. */
export const WEEKDAYS = [
  { value: 0, short: "Sun", letter: "S", long: "Sunday" },
  { value: 1, short: "Mon", letter: "M", long: "Monday" },
  { value: 2, short: "Tue", letter: "T", long: "Tuesday" },
  { value: 3, short: "Wed", letter: "W", long: "Wednesday" },
  { value: 4, short: "Thu", letter: "T", long: "Thursday" },
  { value: 5, short: "Fri", letter: "F", long: "Friday" },
  { value: 6, short: "Sat", letter: "S", long: "Saturday" },
] as const;

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** All IANA zones the runtime knows about, for the settings picker. */
export function supportedTimeZones(): string[] {
  const supported = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf;

  return supported ? supported("timeZone") : ["UTC"];
}

/**
 * The calendar day `instant` falls on in `timeZone`, as a UTC-midnight Date.
 */
export function toLocalDate(instant: Date, timeZone: string): Date {
  // "en-CA" formats as YYYY-MM-DD, which is what we want to reassemble.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "01";

  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

/** Today's calendar day in `timeZone`, as a UTC-midnight Date. */
export function todayLocal(timeZone: string, now: Date = new Date()): Date {
  return toLocalDate(now, timeZone);
}

/**
 * Minutes since midnight in `timeZone`, right now.
 *
 * Safe to render from a Server Component — those don't re-render on the client,
 * so there's nothing to hydrate-mismatch against. In a Client Component it is
 * not: see `useNowMinute` in the calendar, which starts at null for exactly
 * that reason.
 */
export function minuteOfDayLocal(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return get("hour") * 60 + get("minute");
}

/** "2026-07-28" -> UTC-midnight Date. Returns null on anything malformed. */
export function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** UTC-midnight Date -> "2026-07-28". */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function diffInDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/** 0 = Sunday .. 6 = Saturday, for a UTC-midnight LocalDate. */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Inclusive on both ends. Capped so a bad range can't allocate forever. */
export function eachDateInRange(start: Date, end: Date, max = 1000): Date[] {
  const dates: Date[] = [];
  for (
    let cursor = start;
    cursor.getTime() <= end.getTime() && dates.length < max;
    cursor = addDays(cursor, 1)
  ) {
    dates.push(cursor);
  }
  return dates;
}

/** The `weekStart`-aligned week containing `date`. */
export function startOfWeek(date: Date, weekStart: number): Date {
  const offset = (dayOfWeek(date) - weekStart + 7) % 7;
  return addDays(date, -offset);
}

// ---------------------------------------------------------------- display

/**
 * Locale is pinned rather than left to the runtime.
 *
 * Node and the browser routinely resolve different default locales, which
 * hydrates a different string than was server-rendered — React then bails out
 * of patching that subtree. The app's copy is English, so the format is too.
 *
 * The timezone is pinned to UTC because a LocalDate is *already* the user's
 * local day, stored at UTC midnight; formatting it in any other zone would
 * shift it back by a day.
 */
const LOCALE = "en-GB";

function dateFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
}

/** For real timestamps (not LocalDates), rendered in the user's timezone. */
export function formatTimestamp(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}

export function formatDate(date: Date): string {
  return dateFormatter({ day: "numeric", month: "short" }).format(date);
}

export function formatDateWithWeekday(date: Date): string {
  return dateFormatter({
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatFullDate(date: Date): string {
  return dateFormatter({
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** "Today" / "Tomorrow" / "Yesterday" / "Fri 8 Aug", relative to `today`. */
export function formatRelativeDate(date: Date, today: Date): string {
  const delta = diffInDays(date, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1 && delta < 7) {
    return dateFormatter({ weekday: "long" }).format(date);
  }
  if (delta < 0) {
    const days = Math.abs(delta);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  return formatDateWithWeekday(date);
}

// ---------------------------------------------------------------- durations

/** Seconds -> "25:00" or "1:05:33". For the timer readout. */
export function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  const seconds = Math.floor(Math.abs(totalSeconds));

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return hours > 0
    ? `${sign}${hours}:${pad(minutes)}:${pad(secs)}`
    : `${sign}${minutes}:${pad(secs)}`;
}

/** Seconds -> "1h 20m" / "45m" / "30s". For prose and summaries. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Seconds -> "20 min", spelled out for form labels and empty states. */
export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}
