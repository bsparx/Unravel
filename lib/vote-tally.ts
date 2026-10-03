/**
 * Votes per identity, across the whole history — pure, no Prisma.
 *
 * `identity-reinforcement.ts` answers "how well is this identity being fed
 * over a range" against due days. This answers the simpler, cumulative
 * question the stages and treats need: how many votes has each self received,
 * ever, this month, this week and today. A vote is one of:
 *
 *   - a done day of a habit linked to the identity (one per habit per day, the
 *     same one-bar rule as everywhere else), or
 *   - a day a shadow pattern was marked "chose otherwise", for the identity it
 *     pulls against.
 *
 * Sources are keyed so the two kinds can share one pipeline: a habit's key is
 * its task id, a pattern's key is `shadow:<id>`.
 */

export const STRIP_DAYS = 14;
export const RECENT_DAYS = 28;

export type VoteEvent = { source: string; dateISO: string };

export type VoteTally = {
  total: number;
  /** The last 28 days, today included. */
  month: number;
  week: number;
  /** The last 7 days, today included: a rolling week for the review. */
  last7: number;
  today: number;
  /** One flag per day for the last 14 days, oldest first; the last is today. */
  strip: boolean[];
  /**
   * Days without a vote before today, counting back from yesterday (capped at
   * the 28-day window). Today never counts against anyone: it's in progress.
   */
  quietDays: number;
};

export const shadowSource = (patternId: string): string => `shadow:${patternId}`;

export function tallyVotes(input: {
  identityIds: string[];
  /** Which identities each source votes for. */
  sources: Map<string, string[]>;
  /** All-time count of voting days per source. */
  allTime: Map<string, number>;
  /** Voting days per source inside the last 28 days, today included. */
  recent: VoteEvent[];
  todayISO: string;
  weekStartISO: string;
}): Map<string, VoteTally> {
  const { identityIds, sources, allTime, recent, todayISO, weekStartISO } = input;

  const days = isoDaysBack(todayISO, RECENT_DAYS); // oldest first, ends today
  const index = new Map(days.map((dateISO, position) => [dateISO, position]));

  const out = new Map<string, VoteTally>();
  const perDay = new Map<string, number[]>();
  for (const id of identityIds) {
    out.set(id, { total: 0, month: 0, week: 0, last7: 0, today: 0, strip: [], quietDays: 0 });
    perDay.set(id, new Array(days.length).fill(0));
  }

  for (const [source, count] of allTime) {
    for (const id of sources.get(source) ?? []) {
      const tally = out.get(id);
      if (tally) tally.total += count;
    }
  }

  for (const event of recent) {
    const position = index.get(event.dateISO);
    if (position === undefined) continue;
    for (const id of sources.get(event.source) ?? []) {
      const tally = out.get(id);
      if (!tally) continue;
      tally.month += 1;
      if (event.dateISO >= weekStartISO) tally.week += 1;
      if (position >= days.length - 7) tally.last7 += 1;
      if (event.dateISO === todayISO) tally.today += 1;
      perDay.get(id)![position] += 1;
    }
  }

  for (const [id, tally] of out) {
    const counts = perDay.get(id)!;
    tally.strip = counts.slice(-STRIP_DAYS).map((votes) => votes > 0);
    let quiet = 0;
    for (let position = counts.length - 2; position >= 0 && counts[position] === 0; position -= 1) {
      quiet += 1;
    }
    tally.quietDays = counts[counts.length - 1] > 0 ? 0 : quiet;
  }

  return out;
}

/** `count` ISO dates ending at `endISO`, oldest first. UTC arithmetic, DST-proof. */
export function isoDaysBack(endISO: string, count: number): string[] {
  const end = new Date(`${endISO}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, offset) =>
    new Date(end - (count - 1 - offset) * 86_400_000).toISOString().slice(0, 10),
  );
}
