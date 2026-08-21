/**
 * The day page's habit timeline — pure functions, no Prisma, no React.
 *
 * Two ideas, one mechanism. Habits with a time anchor are implementation
 * intentions ("I will do this at 07:00"), and an intention with a when beats
 * one without it. The timeline is what makes the when visible: anchored
 * habits order chronologically on /day, and the "Start here" card names the
 * habit whose moment it is rather than whichever habit happens to sort first.
 */

/** How far ahead a habit's time may be and still read as "start here". */
export const START_HERE_LOOKAHEAD_MINUTES = 120;

/**
 * The one habit the "Start here" card should name.
 *
 * Three rules, in order:
 *
 * 1. The anchored habit whose time has most recently arrived — the moment's
 *    habit, and the catch-up nudge when it slipped.
 * 2. The next anchored habit, but only within the lookahead window. A habit
 *    eleven hours away isn't what to start right now.
 * 3. The first unanchored habit, or the first anchored one when that's all
 *    there is.
 *
 * `habits` may arrive in any order — the anchored subset is re-sorted here so
 * "most recently arrived" never depends on the caller's ordering.
 */
export function startHereHabit<T extends { timeAnchorMinutes: number | null }>(
  habits: T[],
  nowMinute: number,
): T | null {
  if (habits.length === 0) return null;

  const anchored = habits
    .filter((habit) => habit.timeAnchorMinutes !== null)
    .sort(
      (a, b) => (a.timeAnchorMinutes as number) - (b.timeAnchorMinutes as number),
    );
  const unanchored = habits.filter(
    (habit) => habit.timeAnchorMinutes === null,
  );

  const due = anchored.filter(
    (habit) => (habit.timeAnchorMinutes as number) <= nowMinute,
  );
  if (due.length > 0) return due[due.length - 1];

  const upcoming = anchored[0];
  if (
    upcoming &&
    (upcoming.timeAnchorMinutes as number) - nowMinute <=
      START_HERE_LOOKAHEAD_MINUTES
  ) {
    return upcoming;
  }

  return unanchored[0] ?? anchored[0];
}
