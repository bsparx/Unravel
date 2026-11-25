/**
 * How a practice scene is kept: one stage more for every day you show up,
 * one stage less for every scheduled day you miss, and held steady (0) on
 * scheduled rest / off-days.
 *
 * A scene has sixty stages over its base. Each day you do the practice
 * brings the next one; each scheduled day that passes without it takes the
 * newest one away. On a rest day (e.g. a non-training day in your exercise
 * routine or an off-schedule day for fasting), skipping never costs a stage,
 * while doing it anyway still rewards +1. It never goes past whole (sixty)
 * or below the bare base. Nothing else counts: no points, no totals, no
 * minutes. The strip under a scene shows only the last two weeks.
 *
 * Today counts the moment it's done, but isn't held against you while it's
 * still open: a stage only goes once a whole scheduled day has passed without
 * it. So the scene never shrinks in the morning before you've had the chance.
 */

/** How many stages a scene has over its base: two months kept makes it whole. */
export const TEND_DAYS = 60;

/** How many days the strip under a scene shows, before today. */
export const STRIP_DAYS = 14;

export type TendDay = {
  dateISO: string;
  /** "Tue 17 Nov". Empty for days too old to show. */
  label: string;
  done: boolean;
  /**
   * Whether the practice was scheduled on this day. Omitted / `true` means
   * daily (a miss costs -1). `false` means a rest / off-schedule day (a miss
   * holds steady at 0; doing it anyway still earns +1).
   */
  scheduled?: boolean;
};

export type Tending = {
  /** 0 to 60: how many stages the scene shows now. */
  level: number;
  /** Whether today is done. */
  today: boolean;
  /** Whether today is a scheduled day for this practice. */
  todayScheduled: boolean;
  /**
   * The last two weeks, oldest first, for the strip under the scene:
   * ending today once it's done, ending yesterday until then.
   */
  window: TendDay[];
  /** Today, which isn't in the window until it's done. */
  todayDay: TendDay;
  /** The level going into today: every day before it counted. */
  before: number;
  /** The level once today is done. */
  ifDone: number;
  /** Tomorrow's level if today passes without it (equals `before` on a rest day). */
  ifSkipped: number;
};

/**
 * One day's move:
 *   - kept (even on a rest day): +1, capped at TEND_DAYS
 *   - missed on a scheduled day: -1, floored at 0
 *   - skipped on a rest day (`scheduled === false`): unchanged (0)
 */
export function step(level: number, done: boolean, scheduled = true): number {
  if (done) return Math.max(0, Math.min(TEND_DAYS, level + 1));
  if (!scheduled) return Math.max(0, Math.min(TEND_DAYS, level));
  return Math.max(0, Math.min(TEND_DAYS, level - 1));
}

/**
 * The scene's state from a run of days, oldest first, ending today. The run
 * should begin on or before the first day the practice was ever done: before
 * that the scene is bare, and a bare scene has nothing to lose, so earlier
 * days can't change the answer. Fewer than a strip and today are padded as
 * misses at the old end, so a new practice simply starts from nothing.
 */
export function tend(history: readonly TendDay[]): Tending {
  const days = [...history];
  while (days.length < STRIP_DAYS + 1) {
    days.unshift({ dateISO: "", label: "", done: false });
  }

  const todayDay = days[days.length - 1];
  const todayScheduled = todayDay.scheduled !== false;
  const before = days
    .slice(0, -1)
    .reduce((level, day) => step(level, day.done, day.scheduled !== false), 0);
  const ifDone = step(before, true, todayScheduled);

  return {
    level: todayDay.done ? ifDone : before,
    today: todayDay.done,
    todayScheduled,
    window: todayDay.done ? days.slice(-STRIP_DAYS) : days.slice(-(STRIP_DAYS + 1), -1),
    todayDay,
    before,
    ifDone,
    ifSkipped: step(before, false, todayScheduled),
  };
}

const DAY_MS = 86_400_000;

/**
 * Build a weekday schedule predicate (`0 = Sunday .. 6 = Saturday`) for
 * `historySince`. Dates are UTC-midnight local dates, so `getUTCDay()` is exact.
 */
export function scheduledByWeekdays(
  daysOfWeek: readonly number[],
): (date: Date) => boolean {
  const set = new Set(daysOfWeek);
  return (date: Date) => set.has(date.getUTCDay());
}

/**
 * Every day from the first one the practice was done (or two weeks back, if
 * that's earlier) through today, oldest first, marked done and scheduled: what
 * `tend` needs. `doneDays` are ISO days; any after today are ignored. Only
 * the last fifteen get a `label`, since only they're ever shown.
 */
export function historySince(
  todayISO: string,
  doneDays: Iterable<string>,
  label: (date: Date) => string,
  isScheduled?: (date: Date, dateISO: string) => boolean,
): TendDay[] {
  const done = new Set<string>();
  let first = todayISO;
  for (const iso of doneDays) {
    if (iso > todayISO) continue;
    done.add(iso);
    if (iso < first) first = iso;
  }

  const today = Date.parse(`${todayISO}T00:00:00.000Z`);
  const span = Math.max(
    STRIP_DAYS,
    Math.round((today - Date.parse(`${first}T00:00:00.000Z`)) / DAY_MS),
  );
  return Array.from({ length: span + 1 }, (_, i) => {
    const date = new Date(today - (span - i) * DAY_MS);
    const iso = date.toISOString().slice(0, 10);
    const scheduled = isScheduled ? isScheduled(date, iso) : true;
    return {
      dateISO: iso,
      label: span - i <= STRIP_DAYS ? label(date) : "",
      done: done.has(iso),
      ...(scheduled ? {} : { scheduled: false }),
    };
  });
}
