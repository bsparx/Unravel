/**
 * How a Mind scene is kept: by the last two weeks, and nothing else.
 *
 * A scene shows as many of its fourteen stages as there are days you did
 * the practice in the fourteen days that count. Fourteen in a row and it's
 * whole; a missed day takes away the newest stage, and keeps it away until
 * that day has passed out of the window, two weeks later. There are no
 * points and no totals: a month of perfect days and a month off end in the
 * same place, and the only way to a whole scene is to keep coming back.
 *
 * Today counts the moment it's done, but isn't held against you while it's
 * still open: until you've done it, the window is the fourteen days ending
 * yesterday. So the scene never shrinks in the morning before you've had
 * the chance, and every day you show up either adds a stage (the day leaving
 * the window was a miss) or keeps the scene as it is (it was a day done).
 */

export const TEND_DAYS = 14;

export type TendDay = {
  dateISO: string;
  /** "Tue 17 Nov". */
  label: string;
  done: boolean;
};

export type Tending = {
  /** 0 to 14: how many stages the scene shows now. */
  level: number;
  /** Whether today is done. */
  today: boolean;
  /** The fourteen days the level counts, oldest first. */
  window: TendDay[];
  /** Today, which isn't in the window until it's done. */
  todayDay: TendDay;
  /** The level counting only the days before today (the window ending yesterday). */
  before: number;
  /** The level once today is done. */
  ifDone: number;
  /** Tomorrow's level if today passes without it. */
  ifSkipped: number;
};

/**
 * The scene's state from fifteen days of history, oldest first, ending
 * today. Fewer days are padded as misses at the old end, so a new practice
 * simply starts from nothing.
 */
export function tend(history: readonly TendDay[]): Tending {
  const days = history.slice(-(TEND_DAYS + 1));
  while (days.length < TEND_DAYS + 1) {
    days.unshift({ dateISO: "", label: "", done: false });
  }

  const todayDay = days[TEND_DAYS];
  const count = (list: readonly TendDay[]) => list.filter((day) => day.done).length;

  // The fourteen days ending yesterday, and the fourteen ending today.
  const endingYesterday = days.slice(0, TEND_DAYS);
  const endingToday = days.slice(1);

  const before = count(endingYesterday);
  // Doing today adds today and lets the oldest day go.
  const ifDone = count(endingToday.slice(0, -1)) + 1;
  // Tomorrow, without today: the window is the fourteen ending today, today a miss.
  const ifSkipped = count(endingToday.slice(0, -1));

  return {
    level: todayDay.done ? ifDone : before,
    today: todayDay.done,
    window: todayDay.done ? endingToday : endingYesterday,
    todayDay,
    before,
    ifDone,
    ifSkipped,
  };
}

/**
 * Fifteen days ending today, oldest first, each marked done or not. `done`
 * gets the ISO day; `label` formats it for tooltips.
 */
export function historyFrom(
  todayISO: string,
  done: (dateISO: string) => boolean,
  label: (date: Date) => string,
): TendDay[] {
  const today = new Date(`${todayISO}T00:00:00.000Z`);
  return Array.from({ length: TEND_DAYS + 1 }, (_, i) => {
    const date = new Date(today.getTime() + (i - TEND_DAYS) * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    return { dateISO: iso, label: label(date), done: done(iso) };
  });
}
