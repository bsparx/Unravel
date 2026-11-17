import type { User } from "@/lib/generated/prisma/client";
import { addDays, instantToLocalInput, localToInstant, startOfLocalDay, toISODate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { BodyEnabled } from "@/lib/body-tabs";
import {
  dailyTotals,
  fastMinutes,
  formatClockIn,
  formatDayIn,
  islamicDayFor,
  islamicMinutes,
  normalizeWindow,
  protocolOf,
  type FastDay,
  type FastKindId,
  type FastProtocolId,
  type FastWindow,
  type IslamicDay,
} from "@/lib/fasting";
import { getUserTimings } from "@/lib/prayers";

/** How far back the fasting log reaches. */
const HISTORY_DAYS = 90;
/** The bars under the ring. */
const BAR_DAYS = 14;

export function bodyEnabled(user: User): BodyEnabled {
  return { exercises: user.bodyExercisesEnabled, fasting: user.bodyFastingEnabled };
}

/**
 * Fajr and Maghrib as instants for each date, from the user's prayer city,
 * ascending. Days the timings couldn't be had for are left out.
 */
export async function islamicDays(
  user: Pick<User, "timezone" | "prayerCity">,
  dates: Date[],
): Promise<{ city: string; days: IslamicDay[] }> {
  const { city, timings } = await getUserTimings(user, dates);
  const days: IslamicDay[] = [];
  for (const date of dates) {
    const dateISO = toISODate(date);
    const day = timings.get(dateISO);
    if (!day) continue;
    const fajr = localToInstant(dateISO, day.fajr, user.timezone);
    const maghrib = localToInstant(dateISO, day.maghrib, user.timezone);
    if (fajr && maghrib && maghrib > fajr) days.push({ dateISO, fajr, maghrib });
  }
  return { city, days };
}

/** Yesterday, today and tomorrow: enough to place any fast that's running. */
export function islamicSpan(timeZone: string, now: Date = new Date()): Date[] {
  const today = todayLocal(timeZone, now);
  return [addDays(today, -1), today, addDays(today, 1)];
}

export type FastRow = {
  id: string;
  kind: FastKindId;
  startedAtISO: string;
  endedAtISO: string;
  /** datetime-local values in the user's zone, for the edit dialog. */
  startInput: string;
  endInput: string;
  targetMinutes: number;
  minutes: number;
  reached: boolean;
  /** "Sun 16 Nov, 20:10" */
  startLabel: string;
  /** "Mon 12:05", or "12:05" when it ended the day it began. */
  endLabel: string;
};

/** One Islamic day, serialised for the client. */
export type IslamicDayView = {
  fajrISO: string;
  maghribISO: string;
  fajrLabel: string;
  maghribLabel: string;
  minutes: number;
};

export type FastingView = {
  kind: FastKindId;
  /** The intermittent plan. Kept even while Islamic is chosen. */
  window: FastWindow;
  protocol: FastProtocolId;
  /** The planned fast for the current window, in minutes. */
  targetMinutes: number;
  /** Prayer-time fasting: today's and tomorrow's days, and the city. */
  islamic: {
    city: string;
    today: IslamicDayView | null;
    tomorrow: IslamicDayView | null;
    /** Maghrib of the day the running fast belongs to, if it's Islamic. */
    openMaghribISO: string | null;
  };
  open: {
    id: string;
    kind: FastKindId;
    startedAtISO: string;
    startInput: string;
    targetMinutes: number;
  } | null;
  /** Ended fasts, newest first. */
  history: FastRow[];
  /** Oldest first, ending today. */
  days: (FastDay & { label: string })[];
  timeZone: string;
  /** When the server rendered, so the first client paint matches. */
  nowISO: string;
};

export async function getFasting(user: User, now: Date = new Date()): Promise<FastingView> {
  const timeZone = user.timezone;
  const window = normalizeWindow(user.fastEatStart, user.fastEatEnd);
  const since = addDays(startOfLocalDay(timeZone, now), -HISTORY_DAYS);

  // Prayer times are always read, so switching to Islamic answers at once.
  // They're cached per city and day, so this is a database read, not a call.
  const [fasts, islamic] = await Promise.all([
    prisma.fast.findMany({
      where: { userId: user.id, OR: [{ endedAt: null }, { endedAt: { gte: since } }] },
      orderBy: { startedAt: "desc" },
    }),
    islamicDays(user, islamicSpan(timeZone, now)),
  ]);

  const open = fasts.find((fast) => fast.endedAt === null) ?? null;
  const today = todayLocal(timeZone, now);
  const todayISO = toISODate(today);
  const tomorrowISO = toISODate(addDays(today, 1));

  const dayView = (day: IslamicDay | undefined): IslamicDayView | null =>
    day
      ? {
          fajrISO: day.fajr.toISOString(),
          maghribISO: day.maghrib.toISOString(),
          fajrLabel: formatClockIn(day.fajr, timeZone),
          maghribLabel: formatClockIn(day.maghrib, timeZone),
          minutes: islamicMinutes(day),
        }
      : null;

  const openDay = open?.kind === "ISLAMIC" ? islamicDayFor(open.startedAt, islamic.days) : null;

  const history: FastRow[] = fasts
    .filter((fast): fast is typeof fast & { endedAt: Date } => fast.endedAt !== null)
    .map((fast) => {
      const minutes = Math.max(0, Math.floor((fast.endedAt.getTime() - fast.startedAt.getTime()) / 60_000));
      const startDay = formatDayIn(fast.startedAt, timeZone);
      const endDay = formatDayIn(fast.endedAt, timeZone);
      return {
        id: fast.id,
        kind: fast.kind,
        startedAtISO: fast.startedAt.toISOString(),
        endedAtISO: fast.endedAt.toISOString(),
        startInput: instantToLocalInput(fast.startedAt, timeZone),
        endInput: instantToLocalInput(fast.endedAt, timeZone),
        targetMinutes: fast.targetMinutes,
        minutes,
        reached: minutes >= fast.targetMinutes,
        startLabel: `${startDay}, ${formatClockIn(fast.startedAt, timeZone)}`,
        endLabel:
          endDay === startDay
            ? formatClockIn(fast.endedAt, timeZone)
            : `${endDay.split(" ")[0]} ${formatClockIn(fast.endedAt, timeZone)}`,
      };
    });

  const days = dailyTotals(fasts, today, BAR_DAYS, timeZone, now).map((day) => ({
    ...day,
    label: new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${day.dateISO}T00:00:00.000Z`)),
  }));

  const todayIslamic = dayView(islamic.days.find((day) => day.dateISO === todayISO));

  return {
    kind: user.fastKind,
    window,
    protocol: protocolOf(window),
    targetMinutes:
      user.fastKind === "ISLAMIC" && todayIslamic ? todayIslamic.minutes : fastMinutes(window),
    islamic: {
      city: islamic.city,
      today: todayIslamic,
      tomorrow: dayView(islamic.days.find((day) => day.dateISO === tomorrowISO)),
      openMaghribISO: openDay ? openDay.maghrib.toISOString() : null,
    },
    open: open
      ? {
          id: open.id,
          kind: open.kind,
          startedAtISO: open.startedAt.toISOString(),
          startInput: instantToLocalInput(open.startedAt, timeZone),
          targetMinutes: open.targetMinutes,
        }
      : null,
    history,
    days,
    timeZone,
    nowISO: now.toISOString(),
  };
}
