/**
 * Time-blocking arithmetic — pure functions, no React, no Prisma.
 *
 * Every block is (local date, startMinute, endMinute) with minutes counted
 * from local midnight. That representation is the whole trick: it means
 * "do these overlap", "where's the next free hour", "how much of the day is
 * claimed" are integer questions with no timezone, no DST and no `Date` in
 * sight — which is why they can be checked in `pnpm verify` without a clock.
 *
 * The one invariant everything here assumes: `start < end`, both within
 * 0..1440, and end is EXCLUSIVE. Two blocks that touch at 10:00 do not
 * overlap. `clampSpan` is the only way to construct a span, and it enforces it.
 */

export const MINUTES_PER_DAY = 1440;
/** Nothing shorter is a plan, it's a notification. */
export const MIN_BLOCK_MINUTES = 5;
/** What the calendar snaps to. Fifteen is fine-grained enough to be honest
 *  about a 45-minute thing and coarse enough that dragging isn't surgery. */
export const SNAP_MINUTES = 15;

/**
 * The length every scheduled block starts at. Dragging a task onto the
 * calendar or pressing "fit it in" always lands at 15 minutes, whatever the
 * task's estimate says — the estimate is information, not a constraint. The
 * resize handle and the editor are how it moves afterwards.
 */
export const PLAN_DEFAULT_MINUTES = 15;

/** The length every cue block starts at when its habit gets scheduled. */
export const PLAN_CUE_MINUTES = 15;

export type Span = { startMinute: number; endMinute: number };

export type BlockLike = Span & { id?: string };

// ---------------------------------------------------------------- construction

export const clampMinute = (minute: number): number =>
  Number.isFinite(minute)
    ? Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(minute)))
    : 0;

/** Round to the calendar's grid. Used for click-to-create and drag-to-move. */
export const snap = (minute: number, step = SNAP_MINUTES): number =>
  clampMinute(Math.round(clampMinute(minute) / step) * step);

/**
 * The only sanctioned way to build a span.
 *
 * A zero-length or inverted span is coerced rather than rejected: this runs on
 * input from a drag, and the useful response to "you dragged upward" is a
 * sensible block, not an error toast.
 */
export function clampSpan(startMinute: number, endMinute: number): Span {
  const start = Math.min(
    clampMinute(startMinute),
    MINUTES_PER_DAY - MIN_BLOCK_MINUTES,
  );
  const end = Math.max(clampMinute(endMinute), start + MIN_BLOCK_MINUTES);
  return { startMinute: start, endMinute: Math.min(end, MINUTES_PER_DAY) };
}

/** A span of `minutes` starting at `start`, shortened if it would run past midnight. */
export function spanOfLength(start: number, minutes: number): Span {
  return clampSpan(start, clampMinute(start) + Math.max(1, Math.round(minutes)));
}

export const spanMinutes = (span: Span): number =>
  Math.max(0, span.endMinute - span.startMinute);

export const spanSeconds = (span: Span): number => spanMinutes(span) * 60;

// ---------------------------------------------------------------- overlap

/** Half-open intervals: [a.start, a.end) ∩ [b.start, b.end) ≠ ∅. */
export function overlaps(a: Span, b: Span): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/**
 * Everything in `blocks` that collides with `span`, ignoring `exceptId` so
 * editing a block doesn't report it as conflicting with itself.
 */
export function conflictsWith<T extends BlockLike>(
  span: Span,
  blocks: T[],
  exceptId?: string,
): T[] {
  return blocks.filter(
    (block) => block.id !== exceptId && overlaps(span, block),
  );
}

/**
 * Lay overlapping blocks out side by side.
 *
 * Returns a column index and a column count per block, which is all the
 * renderer needs to compute a width and an offset. Overlaps are *allowed* —
 * the calendar's job is to show you that you double-booked, not to refuse the
 * booking. Refusing would just push the double-booking into your head, which
 * is where it does damage.
 *
 * Greedy first-fit over a cluster of mutually-connected blocks. Clusters are
 * broken at any minute where nothing is running, so an uncontested afternoon
 * block is never narrowed by a busy morning.
 */
export function layoutColumns<T extends BlockLike>(
  blocks: T[],
): { block: T; column: number; columns: number }[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );

  const laid: { block: T; column: number; columns: number }[] = [];
  let cluster: typeof laid = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    const width = cluster.reduce((max, item) => Math.max(max, item.column), 0) + 1;
    for (const item of cluster) item.columns = width;
    cluster = [];
  };

  for (const block of sorted) {
    if (block.startMinute >= clusterEnd) closeCluster();

    // First column whose occupant has already finished.
    const taken = new Set(
      cluster
        .filter((item) => overlaps(item.block, block))
        .map((item) => item.column),
    );
    let column = 0;
    while (taken.has(column)) column += 1;

    const item = { block, column, columns: 1 };
    cluster.push(item);
    laid.push(item);
    clusterEnd = Math.max(clusterEnd, block.endMinute);
  }

  closeCluster();
  return laid;
}

// ---------------------------------------------------------------- free time

/**
 * The gaps between `blocks` inside [dayStart, dayEnd), merged.
 *
 * Merging matters: two overlapping blocks must not produce a phantom gap
 * between them, which a naive pairwise walk would.
 */
export function freeSlots(
  blocks: Span[],
  dayStart = 0,
  dayEnd = MINUTES_PER_DAY,
): Span[] {
  const busy = mergeSpans(blocks);
  const slots: Span[] = [];
  let cursor = clampMinute(dayStart);
  const end = clampMinute(dayEnd);

  for (const span of busy) {
    if (span.endMinute <= cursor) continue;
    if (span.startMinute >= end) break;
    if (span.startMinute > cursor) {
      slots.push({ startMinute: cursor, endMinute: Math.min(span.startMinute, end) });
    }
    cursor = Math.max(cursor, span.endMinute);
  }

  if (cursor < end) slots.push({ startMinute: cursor, endMinute: end });
  return slots.filter((slot) => spanMinutes(slot) > 0);
}

/** Union of a set of spans, sorted and coalesced. */
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.startMinute - b.startMinute);
  const merged: Span[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, span.endMinute);
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

/**
 * The first gap at least `minutes` long, at or after `notBefore`.
 *
 * Returns null rather than cramming it in somewhere — "there is no room for
 * this today" is a real and useful answer, and inventing a slot that doesn't
 * fit is how a calendar becomes something you stop trusting.
 */
export function findFreeSlot(
  blocks: Span[],
  minutes: number,
  notBefore = 0,
  dayEnd = MINUTES_PER_DAY,
): Span | null {
  const wanted = Math.max(MIN_BLOCK_MINUTES, Math.round(minutes));

  for (const slot of freeSlots(blocks, notBefore, dayEnd)) {
    // Snap forward into the slot, not backward out of it.
    const start = Math.max(slot.startMinute, snapUp(slot.startMinute));
    if (slot.endMinute - start >= wanted) {
      return { startMinute: start, endMinute: start + wanted };
    }
  }

  return null;
}

const snapUp = (minute: number): number =>
  clampMinute(Math.ceil(clampMinute(minute) / SNAP_MINUTES) * SNAP_MINUTES);

/** How much of the day is claimed, counting overlaps once. */
export function claimedMinutes(blocks: Span[]): number {
  return mergeSpans(blocks).reduce((sum, span) => sum + spanMinutes(span), 0);
}

// ---------------------------------------------------------------- display

/** 545 -> "09:05". 24-hour, because it's unambiguous and it's a grid. */
export function formatMinuteOfDay(minute: number): string {
  const clamped = clampMinute(minute);
  const hours = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "09:05 – 10:30" */
export function formatSpan(span: Span): string {
  return `${formatMinuteOfDay(span.startMinute)} – ${formatMinuteOfDay(
    span.endMinute,
  )}`;
}

/** "1h 30m" / "45m" / "none". A duration in minutes, spelled for prose. */
export function formatMinuteLength(total: number): string {
  const clamped = Math.max(0, Math.round(total));
  if (clamped === 0) return "none";
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** The same, for a span. Used on the block body. */
export const formatSpanLength = (span: Span): string =>
  formatMinuteLength(spanMinutes(span));

/** "09:05" -> 545. Null on anything malformed, so a bad input can't shift a day. */
export function parseMinuteOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > MINUTES_PER_DAY ? null : total;
}
