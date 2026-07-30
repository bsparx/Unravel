/**
 * Habit stacking — pure functions, no Prisma, no React.
 *
 * A cue is the one thing that immediately precedes a habit: "after I pour my
 * morning tea, I will meditate". The anchor is either another tracked habit or
 * a plain label for something you already do and deliberately don't track.
 *
 * Two things live here because they are the parts that can be checked without a
 * database or a clock, in `pnpm verify`:
 *
 * - the arithmetic of where a cue's calendar block goes, and
 * - the cycle check, which is the one way this model can be corrupted.
 */

import {
  clampMinute,
  clampSpan,
  MIN_BLOCK_MINUTES,
  type Span,
} from "@/lib/block-math";

/** The shape both the DB row and the form draft collapse to. */
export type Cue = {
  anchorTaskId: string | null;
  anchorLabel: string | null;
  anchorMinutes: number;
};

/** A cue resolved for display: the anchor's title, whatever kind it is. */
export type ResolvedCue = Cue & { anchorTitle: string };

// ---------------------------------------------------------------- naming

/**
 * The anchor's title. A habit anchor's title comes from the habit; a label
 * anchor is its own title.
 *
 * Returns null for a row that names neither — which the schema forbids, but a
 * cascade-deleted anchor read mid-flight is cheaper to tolerate than to crash on.
 */
export function anchorTitleOf(
  cue: Pick<Cue, "anchorTaskId" | "anchorLabel">,
  anchorHabitTitle?: string | null,
): string | null {
  if (cue.anchorTaskId) return anchorHabitTitle?.trim() || null;
  return cue.anchorLabel?.trim() || null;
}

/**
 * "After pouring my morning tea".
 *
 * Deliberately not "After: tea" or a bare label — the sentence form is the
 * technique. Reading the trigger as a sentence is what makes the next action
 * obvious, and it is the only thing a label anchor contributes at all.
 */
export function describeCue(title: string | null): string | null {
  return title ? `After ${title}` : null;
}

/** "After pouring my morning tea, I will meditate." The full recipe. */
export function describeStack(
  title: string | null,
  habitTitle: string,
): string | null {
  const prefix = describeCue(title);
  return prefix ? `${prefix}, I will ${habitTitle.trim() || "…"}.` : null;
}

// ---------------------------------------------------------------- placement

/**
 * How long to reserve for an anchor on the calendar.
 *
 * A habit anchor's own estimate wins: it is the number that habit already
 * commits to everywhere else, and a cue block that disagrees with the same
 * habit's own block would be two answers to one question. `anchorMinutes` is
 * the fallback, and the only source for a label anchor.
 */
export function cueLengthMinutes(
  cue: Cue,
  anchorEstimatedSeconds?: number | null,
): number {
  const fromEstimate =
    cue.anchorTaskId && anchorEstimatedSeconds
      ? Math.round(anchorEstimatedSeconds / 60)
      : null;

  return Math.max(MIN_BLOCK_MINUTES, fromEstimate ?? cue.anchorMinutes);
}

/**
 * The span immediately before `span`, `minutes` long.
 *
 * Placed, never fitted. Adjacency is the entire mechanism — a cue squeezed into
 * the next free gap at 14:00 is not a cue for a 08:00 habit, it's an unrelated
 * block. So this abuts exactly (`cue.endMinute === span.startMinute`) and, up
 * against midnight, gives back whatever room is left rather than moving the
 * habit to make space. A habit at 00:00 has nothing before it, and shortening
 * the cue is the honest way to say so.
 */
export function cueSpanFor(span: Span, minutes: number): Span | null {
  const end = clampMinute(span.startMinute);
  const start = Math.max(0, end - Math.max(1, Math.round(minutes)));

  if (end - start < 1) return null;

  // clampSpan would push the end past `span.startMinute` to satisfy
  // MIN_BLOCK_MINUTES, which would overlap the habit it's cueing. Adjacency
  // wins over the minimum length here.
  return end - start < MIN_BLOCK_MINUTES
    ? { startMinute: start, endMinute: end }
    : clampSpan(start, end);
}

// ---------------------------------------------------------------- chains

/**
 * habit id -> the id of the habit it is stacked on. Label anchors are absent:
 * they are leaves and can never take part in a cycle.
 */
export type CueEdges = Map<string, string>;

export function cueEdges(
  rows: { taskId: string; anchorTaskId: string | null }[],
): CueEdges {
  const edges: CueEdges = new Map();
  for (const row of rows) {
    if (row.anchorTaskId) edges.set(row.taskId, row.anchorTaskId);
  }
  return edges;
}

/**
 * Would stacking `habitId` on `anchorTaskId` close a loop?
 *
 * The chain is a linked list walked by following each habit's own anchor, so a
 * cycle anywhere in it would make `chainOf` — and every surface that renders
 * the recipe — spin forever. Checked on write rather than defended against on
 * read: there is exactly one place a cycle can be created, and rejecting it
 * there is the only fix that leaves the data honest.
 *
 * Catches self-anchoring for free (`anchorTaskId === habitId`).
 */
export function wouldCycle(
  habitId: string,
  anchorTaskId: string,
  edges: CueEdges,
): boolean {
  let cursor: string | undefined = anchorTaskId;
  const seen = new Set<string>([habitId]);

  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    // The edge being proposed replaces whatever habitId points at today, so
    // the walk uses the stored edges from the anchor onward only.
    cursor = edges.get(cursor);
  }

  return false;
}

/**
 * The stack `habitId` sits at the end of, earliest first: given
 * tea -> meditation -> journal, `chainOf("journal")` is
 * ["meditation", "journal"] as ids, with the label anchor supplied separately.
 *
 * Cycle-safe regardless of what's in the map — `wouldCycle` should mean this
 * can't happen, but a walk that could hang the render on bad data is not worth
 * the two lines it saves.
 */
export function chainOf(habitId: string, edges: CueEdges): string[] {
  const chain: string[] = [habitId];
  const seen = new Set<string>([habitId]);

  let cursor = edges.get(habitId);
  while (cursor && !seen.has(cursor)) {
    chain.unshift(cursor);
    seen.add(cursor);
    cursor = edges.get(cursor);
  }

  return chain;
}
