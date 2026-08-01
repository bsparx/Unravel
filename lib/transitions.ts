/**
 * The gap between two blocks, as an object.
 *
 * Pure — no React, no Prisma — so `pnpm verify` covers it, exactly like
 * `block-math.ts` which it is built on.
 *
 * The calendar could already compute these: `freeSlots` has always returned
 * every gap in the day, and the page used it for a single header stat. What was
 * missing was the idea that a gap is a *thing*. Planning software treats the
 * space between two blocks as the absence of a plan, which is the one reading
 * that is definitely wrong for someone whose day comes apart at exactly that
 * point. Switching from one task to another is work — it takes a length of
 * time, that length is knowable, and a plan that allots it nothing is a plan
 * that fails on the first switch and cascades from there.
 *
 * Deliberately derived rather than stored. A `TimeBlock` row would have to be
 * reconciled on every drag, resize and delete, and would eventually disagree
 * with the blocks around it. A derived value cannot drift.
 */

import {
  freeSlots,
  mergeSpans,
  spanMinutes,
  type Span,
} from "@/lib/block-math";

/**
 * Longer than this and the gap is not a transition, it is just free time.
 *
 * Free time needs no help from the calendar; the switch does. Drawing a strip
 * across a two-hour hole would make the day look busier than it is, which is
 * the opposite of what this surface is for.
 */
export const TRANSITION_MAX_MINUTES = 30;

/** At or under this, the switch has no room in it. */
export const TIGHT_MINUTES = 5;

export type TransitionKind =
  /** No gap at all — the blocks touch. */
  | "none"
  /** A gap, but not one you can actually switch in. */
  | "tight"
  /** Enough room to stop, stand up, and start the next thing. */
  | "ok";

export type Transition = Span & {
  kind: TransitionKind;
  minutes: number;
  /** What you are coming out of. Null at the start of the day. */
  beforeTitle: string | null;
  /** What you are going into. Null at the end of the day. */
  afterTitle: string | null;
};

export type TransitionBlock = Span & {
  id: string;
  title: string;
  /**
   * Set when this block is a habit-stack cue sitting against its habit.
   *
   * That adjacency is a feature, not a mistake — `cueSpanFor` builds the pair
   * to abut exactly, because "after I pour my tea, I will meditate" only works
   * if nothing comes between them. Flagging a transition there would be the
   * calendar warning about the one piece of deliberate design in the day.
   */
  cueForId: string | null;
  hasCue: boolean;
};

/**
 * Every switch in one day, in order.
 *
 * Only between blocks: the space before the first and after the last is the
 * rest of your life, not a transition.
 */
export function transitionsForDay(blocks: TransitionBlock[]): Transition[] {
  const ordered = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  if (ordered.length < 2) return [];

  const transitions: Transition[] = [];

  const push = (gap: Span) => {
    const minutes = spanMinutes(gap);
    if (minutes > TRANSITION_MAX_MINUTES) return;

    const before = lastEndingAt(ordered, gap.startMinute);
    const after = firstStartingAt(ordered, gap.endMinute);

    // The cue pair is meant to touch. Saying nothing here is the point.
    if (before && after && isCuePair(before, after)) return;

    transitions.push({
      ...gap,
      minutes,
      kind: minutes === 0 ? "none" : minutes <= TIGHT_MINUTES ? "tight" : "ok",
      beforeTitle: before?.title ?? null,
      afterTitle: after?.title ?? null,
    });
  };

  // Real gaps, off the merged list so two overlapping blocks cannot open a
  // phantom one between them — the same reason `freeSlots` merges before it
  // walks.
  const busy = mergeSpans(ordered);
  for (let i = 0; i < busy.length - 1; i += 1) {
    push({
      startMinute: busy[i].endMinute,
      endMinute: busy[i + 1].startMinute,
    });
  }

  // Blocks that touch exactly are invisible to the merged walk — `mergeSpans`
  // coalesces them into one span, so the zero-minute switch, which is the one
  // most worth flagging, would be the only one this never reported. Found on
  // the unmerged list instead.
  for (let i = 0; i < ordered.length - 1; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      if (ordered[j].startMinute > ordered[i].endMinute) break;
      if (ordered[j].startMinute === ordered[i].endMinute) {
        push({
          startMinute: ordered[i].endMinute,
          endMinute: ordered[i].endMinute,
        });
      }
    }
  }

  return transitions.sort((a, b) => a.startMinute - b.startMinute);
}

/** How much of the day is spent switching rather than doing. */
export function transitionMinutes(transitions: Transition[]): number {
  return transitions.reduce((total, transition) => total + transition.minutes, 0);
}

/** Switches the day has left no room for at all. */
export function tightCount(transitions: Transition[]): number {
  return transitions.filter((transition) => transition.kind !== "ok").length;
}

/**
 * Would putting a block here leave no room to switch into it?
 *
 * Used at drop time. It reports rather than prevents: "there is no room for
 * this" is a real answer this app already gives elsewhere, and a calendar that
 * silently refuses a placement is one you stop trusting.
 */
export function abutsNeighbour(
  span: Span,
  blocks: TransitionBlock[],
  ignoreId?: string,
): boolean {
  return blocks.some((block) => {
    if (block.id === ignoreId) return false;
    if (block.cueForId !== null) return false;

    const before = span.startMinute - block.endMinute;
    const after = block.startMinute - span.endMinute;

    return (
      (before >= 0 && before <= TIGHT_MINUTES) ||
      (after >= 0 && after <= TIGHT_MINUTES)
    );
  });
}

const lastEndingAt = (
  blocks: TransitionBlock[],
  minute: number,
): TransitionBlock | undefined =>
  [...blocks].reverse().find((block) => block.endMinute === minute);

const firstStartingAt = (
  blocks: TransitionBlock[],
  minute: number,
): TransitionBlock | undefined =>
  blocks.find((block) => block.startMinute === minute);

const isCuePair = (before: TransitionBlock, after: TransitionBlock): boolean =>
  before.cueForId === after.id || after.cueForId === before.id;

// Re-exported so callers get the day's gaps and its transitions from one place.
export { freeSlots };
