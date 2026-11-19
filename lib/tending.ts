/**
 * How a Mind scene is kept: one stage more for every day you show up, one
 * stage less for every day you don't.
 *
 * A scene has fourteen stages over its base. Each day you do the practice
 * brings the next one; each day that passes without it takes the newest one
 * away. It never goes past whole (fourteen) or below the bare base, so a run
 * of days fills it, a missed day costs exactly one stage, and the next day you
 * come back earns that stage straight back. Nothing else counts: no points,
 * no totals, no minutes.
 *
 * Today counts the moment it's done, but isn't held against you while it's
 * still open: a stage only goes once a whole day has passed without it. So
 * the scene never shrinks in the morning before you've had the chance.
 */

/** How many stages a scene has over its base. */
export const TEND_DAYS = 14;

export type TendDay = {
  dateISO: string;
  /** "Tue 17 Nov". Empty for days too old to show. */
  label: string;
  done: boolean;
};

export type Tending = {
  /** 0 to 14: how many stages the scene shows now. */
  level: number;
  /** Whether today is done. */
  today: boolean;
  /**
   * The last fourteen days, oldest first, for the strip under the scene:
   * ending today once it's done, ending yesterday until then.
   */
  window: TendDay[];
  /** Today, which isn't in the window until it's done. */
  todayDay: TendDay;
  /** The level going into today: every day before it counted. */
  before: number;
  /** The level once today is done. */
  ifDone: number;
  /** Tomorrow's level if today passes without it. */
  ifSkipped: number;
};

/** One day's move: up a stage for a day kept, down one for a day missed. */
export function step(level: number, done: boolean): number {
  return Math.max(0, Math.min(TEND_DAYS, level + (done ? 1 : -1)));
}

/**
 * The scene's state from a run of days, oldest first, ending today. The run
 * should begin on or before the first day the practice was ever done: before
 * that the scene is bare, and a bare scene has nothing to lose, so earlier
 * days can't change the answer. Fewer than fifteen days are padded as misses
 * at the old end, so a new practice simply starts from nothing.
 */
export function tend(history: readonly TendDay[]): Tending {
  const days = [...history];
  while (days.length < TEND_DAYS + 1) {
    days.unshift({ dateISO: "", label: "", done: false });
  }

  const todayDay = days[days.length - 1];
  const before = days.slice(0, -1).reduce((level, day) => step(level, day.done), 0);
  const ifDone = step(before, true);

  return {
    level: todayDay.done ? ifDone : before,
    today: todayDay.done,
    window: todayDay.done ? days.slice(-TEND_DAYS) : days.slice(-(TEND_DAYS + 1), -1),
    todayDay,
    before,
    ifDone,
    ifSkipped: step(before, false),
  };
}

const DAY_MS = 86_400_000;

/**
 * Every day from the first one the practice was done (or two weeks back, if
 * that's earlier) through today, oldest first, marked done or not: what
 * `tend` needs. `doneDays` are ISO days; any after today are ignored. Only
 * the last fifteen get a `label`, since only they're ever shown.
 */
export function historySince(
  todayISO: string,
  doneDays: Iterable<string>,
  label: (date: Date) => string,
): TendDay[] {
  const done = new Set<string>();
  let first = todayISO;
  for (const iso of doneDays) {
    if (iso > todayISO) continue;
    done.add(iso);
    if (iso < first) first = iso;
  }

  const today = Date.parse(`${todayISO}T00:00:00.000Z`);
  const span = Math.max(TEND_DAYS, Math.round((today - Date.parse(`${first}T00:00:00.000Z`)) / DAY_MS));
  return Array.from({ length: span + 1 }, (_, i) => {
    const date = new Date(today - (span - i) * DAY_MS);
    const iso = date.toISOString().slice(0, 10);
    return { dateISO: iso, label: span - i <= TEND_DAYS ? label(date) : "", done: done.has(iso) };
  });
}
