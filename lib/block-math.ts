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

// ---------------------------------------------------------------- naming

/**
 * The least a block needs to be nameable: what it was called, and what is in
 * it. Structural rather than importing `CalendarBlock` — this file is pure and
 * has to stay importable from a client component without dragging Prisma in
 * with it.
 */
export type BlockNaming = {
  title: string;
  tasks: { title: string }[];
};

/**
 * What to call a block when something has to print one string.
 *
 * A named block keeps its name — "gym" is a better label than the three things
 * you happen to do there. Only when nobody named it does it fall back to its
 * contents: one task reads as the task (so a block with a single task is
 * indistinguishable from the way it always looked), several read as a count.
 */
export function blockLabel(block: BlockNaming): string {
  if (block.title.trim().length > 0) return block.title;

  const [first, ...rest] = block.tasks;
  if (!first) return "Untitled block";
  if (rest.length === 0) return first.title;
  return `${block.tasks.length} tasks`;
}

/**
 * The block's contents spelled out — "Draft outline, Pull the charts +1".
 *
 * The long form, for a tooltip or a line of prose. Ordered exactly as the block
 * holds them, which is the order they were added and not a priority claim.
 */
export function blockTaskSummary(block: BlockNaming, max = 2): string {
  const names = block.tasks.map((task) => task.title);
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/**
 * How much of the block is done, as a fraction of what is in it.
 *
 * The one number a group has that a single-task block doesn't, which is why it
 * is what an unnamed group is *called* on the grid. It counts the block's own
 * ticks, not `Task.completedAt` — those are different claims, and a block only
 * ever speaks for its own.
 *
 * Returns null for a block with nothing in it: "0 of 0" is not a fact, it is a
 * placeholder, and a named block has a name to print instead.
 */
export function blockProgressParts(block: {
  tasks: { doneAt: Date | null }[];
}): { done: number; total: number } | null {
  if (block.tasks.length === 0) return null;

  return {
    done: block.tasks.filter((task) => task.doneAt !== null).length,
    total: block.tasks.length,
  };
}

// ---------------------------------------------------------------- fitting

/**
 * The vertical metrics a block's body is laid out in.
 *
 * Here rather than in the grid because two callers need them and they have to
 * agree: the component draws to them, and `scripts/verify-logic.ts` checks that
 * what it draws fits. A second copy is a second truth.
 */

// Measured off the classes the chip actually wears, not guessed: `py-1` is 8px,
// the heading is one `leading-4`, and so on. A claim on the height that is
// wrong by 4px is invisible until it is a task line that doesn't fit.

/** One task line inside a block. */
export const TASK_LINE_PX = 16;
/** The heading row — one `leading-4`, whichever density it is set at. */
export const HEADER_PX = 16;
/** The "09:00 · 2h" stamp. */
export const META_PX = 14;
/** The breath between the heading and the list it introduces. */
export const LIST_GAP_PX = 4;
/** A row grows into a tall block up to here, and no further. */
export const TASK_ROW_MAX_PX = 30;
/** The chip's own vertical padding: `py-1`. */
export const CHIP_PAD_Y_PX = 8;
/** …and `py-0` below this, where 8px of air is the difference between a heading
 *  and a heading half-clipped by its own border. */
export const TIGHT_CHIP_PAD_Y_PX = 0;
/** The stamp's own top padding: `pt-0.5`. */
export const FOOTER_PAD_PX = 2;
/** Nothing shorter than this is worth drawing, so short blocks fall back. */
export const BLOCK_MIN_HEIGHT_PX = 18;
/** Under this many minutes a block drops its padding rather than its heading.
 *  Five minutes is the shortest block the grid will make, and it is 18px. */
export const TIGHT_MINUTES = 15;

export type TaskLineFit = {
  /** Whether to draw the checklist at all. */
  showList: boolean;
  /** Task lines that fit. */
  visible: number;
  /** Left over, drawn as a single "+N more" line. Zero when everything fits. */
  hidden: number;
  /** Raw line capacity, so a caller can decide on a count line instead. */
  room: number;
};

/**
 * How much of a block's task list fits in the space the block actually has.
 *
 * Its own pixels are the only thing that knows: the grid runs at 2px per minute,
 * so a 40-minute block and a 2-hour one are the same component at different
 * heights, and a breakpoint list would be a second, drifting copy of the truth.
 *
 * Two rules, both about honesty rather than tidiness. A list needs at least two
 * spare lines, because the summary takes one of them and "1 task, +2 more" is a
 * list that teases rather than helps — below that the caller says how many there
 * are instead. And nothing is ever drawn clipped: a half-line at the bottom is
 * a task you would read as absent.
 */
export function fitTaskLines(
  availablePx: number,
  taskCount: number,
  linePx = TASK_LINE_PX,
): TaskLineFit {
  const room = Math.max(0, Math.floor(availablePx / linePx));

  if (taskCount <= room) {
    return { showList: taskCount > 0, visible: taskCount, hidden: 0, room };
  }

  if (room < 2) return { showList: false, visible: 0, hidden: taskCount, room };

  const visible = room - 1;
  return { showList: true, visible, hidden: taskCount - visible, room };
}

export type BlockBodyLayout = {
  fit: TaskLineFit;
  /** Draw the "09:00 · 2h" stamp. It yields to the list when a line depends on it. */
  showMeta: boolean;
};

/**
 * The whole body decision for one block: what fits, and what has to give.
 *
 * One function rather than arithmetic in the component, because the budget is
 * exact and easy to get subtly wrong — a missing 8px of chip padding is
 * invisible until a 45-minute block with three tasks is 8px too short and the
 * stamp lands on top of the last row. Every claim on the height is named here.
 *
 * `taskCount` must be 0 for a block whose list will not be drawn at all (a
 * single-task block): there is no list to make room for, and letting one
 * pretend otherwise would trade the stamp away for a line that never appears.
 */
export function layoutBlockBody({
  heightPx,
  taskCount,
  isCue,
  compact,
  tight,
}: {
  /** The chip's full height, as drawn. */
  heightPx: number;
  /** Tasks that would be listed, or 0 when no list is drawn. */
  taskCount: number;
  isCue: boolean;
  compact: boolean;
  /** Under `TIGHT_MINUTES`: no padding, so the heading still fits. */
  tight: boolean;
}): BlockBodyLayout {
  // A cue is one line borrowed from the habit below it. It has no body.
  if (isCue) return { fit: fitTaskLines(0, 0), showMeta: false };

  const padY = tight ? TIGHT_CHIP_PAD_Y_PX : CHIP_PAD_Y_PX;
  const budget = heightPx - padY - HEADER_PX - LIST_GAP_PX;

  if (compact) return { fit: fitTaskLines(budget, taskCount), showMeta: false };

  const withMeta = fitTaskLines(budget - META_PX - FOOTER_PAD_PX, taskCount);

  // The stamp is the least load-bearing thing in a block: if it is costing a
  // task line, it goes. "What is in these two hours" beats "when they are",
  // and a 45-minute block with three things in it is exactly that trade.
  const withoutMeta = fitTaskLines(budget, taskCount);
  if (withoutMeta.hidden < withMeta.hidden) {
    return { fit: withoutMeta, showMeta: false };
  }

  return { fit: withMeta, showMeta: true };
}

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
