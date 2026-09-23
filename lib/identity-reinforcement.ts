/**
 * Identity reinforcement — pure functions. No React, no Prisma.
 *
 * The identity loop (Atomic Habits): every habit kept is a **vote** for the
 * type of person you want to become. An identity is the name of that person,
 * a habit is linked to the identities it is evidence for, and this module
 * turns the habit statistics into the tally per identity:
 *
 *   **Vote opportunity** — a due habit-day of a linked habit. A habit linked
 *   to two identities casts one full vote for each: a vote for *each* self,
 *   never split between them.
 *
 *   **Vote earned** — that habit-day's minimum was met (OPTIMAL or MINIMUM).
 *   The two tiers are reported separately but count as one vote each: the
 *   minimum is what keeps a streak, and making the good day the bar is how
 *   streaks break. Same two-bar rule as everywhere else.
 *
 *   **Missed** — a due day that came and went with no vote. A deliberate
 *   SKIPPED day is neither a vote nor a miss — it's reported as its own
 *   number, because a decision to rest is not a lapse.
 *
 * Everything is *derived* from per-day outcomes — no event log, no stored
 * counters, nothing to drift. Which also means the tally reads history
 * through the links as they stand today: relinking is a correction of which
 * habits count as evidence, and this treats it as one.
 */

/** The outcomes this module understands. Matches `HabitStatsView`'s. */
export type VoteOutcome = "OPTIMAL" | "MINIMUM" | "SKIPPED" | "MISSED" | "PENDING";

/** One due day of one habit. Non-due days are deliberately absent. */
export type VoteDay = {
  dateISO: string;
  outcome: VoteOutcome;
};

/** The slice of a habit's statistics the tally needs. */
export type VoteHabit = {
  id: string;
  title: string;
  days: VoteDay[];
};

/** Who you are becoming. */
export type IdentitySeed = {
  id: string;
  name: string;
  statement: string | null;
  characteristics: string | null;
};

/** One "this habit votes for this identity" claim. */
export type IdentityLink = {
  identityId: string;
  taskId: string;
};

/** One day of one identity: how many opportunities, how many votes. */
export type IdentityDay = {
  dateISO: string;
  due: number;
  votes: number;
  /** At least one vote landed. The touched-day strip draws these. */
  touched: boolean;
};

/** A linked habit that cost this identity votes, worst first. */
export type StarvingHabit = {
  habitId: string;
  title: string;
  missed: number;
};

export type IdentityReinforcement = IdentitySeed & {
  /** Every due habit-day of every linked habit inside the range. */
  expected: number;
  /** Opportunities that became votes: the minimum was met. */
  votes: number;
  /** Of the votes, how many were good days (the optimal). */
  optimalVotes: number;
  minimumVotes: number;
  /** Opportunities with no vote and no deliberate skip. */
  missed: number;
  /** Deliberately passed on. Neither a vote nor a miss. */
  skipped: number;
  /** Today's unspent opportunities. Today is never "missed". */
  pending: number;

  /** Percent of opportunities that became votes. 0..100. */
  reinforcement: number;
  /** Percent of votes that were good days. 0..100. */
  optimalShare: number;

  /**
   * Consecutive due days with no vote at the tail of the range, walking back
   * from the present. Days with nothing due are gaps, not cold — a Friday-only
   * habit is not going cold Monday through Thursday. Voted today is never
   * cold, and today itself doesn't count against an unvoted identity: the day
   * is still in progress.
   */
  coldDueDays: number;

  /** Linked habits that missed, most-missed first. */
  starving: StarvingHabit[];
  /** Every linked habit in view, for the chips and the dialog. */
  linked: { habitId: string; title: string }[];
  /** One row per day in the range — due or not — so the strip aligns. */
  daily: IdentityDay[];
};

/**
 * The tally for every identity, over one habit-stats read.
 *
 * Every identity comes out, even one with no links at all: the identity page
 * has to show — and offer to edit — an identity nobody votes for yet.
 * Surfaces that only show *tallies* skip the empty ones themselves
 * (`linked.length === 0`), which is also what keeps a habit hidden by the
 * stats filter from making its identity look neglected.
 */
export function reinforceIdentities(
  identities: IdentitySeed[],
  links: IdentityLink[],
  habits: VoteHabit[],
  range: { fromISO: string; toISO: string; todayISO: string },
): IdentityReinforcement[] {
  const habitById = new Map(habits.map((habit) => [habit.id, habit]));
  const dates = isoDatesBetween(range.fromISO, range.toISO);

  const out: IdentityReinforcement[] = [];

  for (const identity of identities) {
    // Set semantics for safety, though the PK already forbids duplicates.
    const linkedIds = [
      ...new Set(
        links
          .filter((link) => link.identityId === identity.id)
          .map((link) => link.taskId),
      ),
    ];
    const linkedHabits = linkedIds
      .map((id) => habitById.get(id))
      .filter((habit): habit is VoteHabit => habit !== undefined);

    let expected = 0;
    let votes = 0;
    let optimalVotes = 0;
    let minimumVotes = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;

    const byDate = new Map<string, IdentityDay>(
      dates.map((dateISO) => [dateISO, { dateISO, due: 0, votes: 0, touched: false }]),
    );

    const starving: StarvingHabit[] = [];

    for (const habit of linkedHabits) {
      let habitMissed = 0;

      for (const day of habit.days) {
        expected += 1;

        const bucket = byDate.get(day.dateISO);
        if (bucket) bucket.due += 1;

        switch (day.outcome) {
          case "OPTIMAL":
            votes += 1;
            optimalVotes += 1;
            if (bucket) {
              bucket.votes += 1;
              bucket.touched = true;
            }
            break;
          case "MINIMUM":
            votes += 1;
            minimumVotes += 1;
            if (bucket) {
              bucket.votes += 1;
              bucket.touched = true;
            }
            break;
          case "SKIPPED":
            skipped += 1;
            break;
          case "MISSED":
            missed += 1;
            habitMissed += 1;
            break;
          case "PENDING":
            pending += 1;
            break;
        }
      }

      if (habitMissed > 0) {
        starving.push({ habitId: habit.id, title: habit.title, missed: habitMissed });
      }
    }

    const daily = dates.map(
      (dateISO) =>
        byDate.get(dateISO) ?? { dateISO, due: 0, votes: 0, touched: false },
    );

    out.push({
      ...identity,
      expected,
      votes,
      optimalVotes,
      minimumVotes,
      missed,
      skipped,
      pending,
      reinforcement: percent(votes, expected),
      optimalShare: percent(optimalVotes, votes),
      coldDueDays: coldWalk(daily, range.todayISO),
      starving: starving.sort((a, b) => b.missed - a.missed),
      linked: linkedHabits.map((habit) => ({ habitId: habit.id, title: habit.title })),
      daily,
    });
  }

  return out;
}

/**
 * The identities to worry about, hungriest first.
 *
 * Sorted by reinforcement rate, then by how long the current cold spell has
 * run — an identity at 70% but cold for a week is hungrier than one at 55%
 * voted this morning. Identities with nothing due in the range, or with
 * nothing actually wrong, stay out of it: a "needs focus" list that includes
 * the thriving is a list that gets ignored.
 */
export function needsFocus(
  identities: IdentityReinforcement[],
): IdentityReinforcement[] {
  return identities
    .filter(
      (identity) => identity.expected > 0 && (identity.missed > 0 || identity.coldDueDays > 0),
    )
    .sort(
      (a, b) =>
        a.reinforcement - b.reinforcement ||
        b.coldDueDays - a.coldDueDays ||
        b.missed - a.missed,
    );
}

/** The cold walk — see `coldDueDays`. */
function coldWalk(daily: IdentityDay[], todayISO: string): number {
  const today = daily.find((day) => day.dateISO === todayISO);
  // Voted today: whatever happened last week, the spell is over.
  if (today && today.touched) return 0;

  let cold = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    const day = daily[i];
    // Today is in progress — unspent, not lapsed.
    if (day.dateISO === todayISO) continue;
    // Nothing due: a gap in the schedule, not a cold spell.
    if (day.due === 0) continue;
    if (day.touched) break;
    cold += 1;
  }
  return cold;
}

/**
 * Every ISO date from `fromISO` through `toISO`, inclusive.
 *
 * Date strings, not Date objects: the whole identity layer speaks local
 * calendar days (the pre-bucketed kind every day column here uses), and
 * incrementing UTC midnight keeps this pure and DST-proof.
 */
export function isoDatesBetween(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${fromISO}T00:00:00Z`);
  const end = new Date(`${toISO}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
