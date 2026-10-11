/**
 * Interval blocks — pure logic. No React, no Prisma.
 *
 * A beat block splits its stretch of time into 15- or 30-minute intervals and
 * asks for one thing in each: a habit step, a task, anything, however small or
 * hasty. Then rest until the next one starts. The point is the cadence, not
 * the size of the thing — a thirty-second tick counts exactly as much as a
 * fifteen-minute one.
 *
 * Everything here is minutes from local midnight, the same representation as
 * `lib/block-math.ts`, so it checks in `pnpm verify` without a clock.
 */

import { type Span, spanMinutes } from "@/lib/block-math";

/** The only cadences offered. Two, because choosing is a cost too. */
export const BEAT_MINUTES = [15, 30] as const;

export type BeatMinutes = (typeof BEAT_MINUTES)[number];

export const isBeatMinutes = (value: unknown): value is BeatMinutes =>
  BEAT_MINUTES.includes(value as BeatMinutes);

/**
 * How many intervals fit in the block. Rounds up: a 50-minute block at 15 has a
 * short fourth interval rather than ten unclaimed minutes at the end.
 */
export const beatCount = (span: Span, minutes: number): number =>
  minutes > 0 ? Math.ceil(spanMinutes(span) / minutes) : 0;

/** Interval `index`'s own window, clamped to the block's end. */
export function beatWindow(span: Span, minutes: number, index: number): Span {
  const startMinute = span.startMinute + index * minutes;
  return {
    startMinute,
    endMinute: Math.min(span.endMinute, startMinute + minutes),
  };
}

/** Which interval `minute` falls in, or null outside the block. */
export function beatIndexAt(
  span: Span,
  minutes: number,
  minute: number,
): number | null {
  if (minutes <= 0) return null;
  if (minute < span.startMinute || minute >= span.endMinute) return null;
  return Math.floor((minute - span.startMinute) / minutes);
}

/**
 * The indices that count, in order.
 *
 * Only those below `count`: shortening a block hides the marks past its new
 * end without deleting them, so resizing it back gives them back.
 */
export const doneBeatIndices = (
  beats: { index: number }[],
  count: number,
): number[] =>
  [...new Set(beats.map((beat) => beat.index))]
    .filter((index) => index >= 0 && index < count)
    .sort((a, b) => a - b);

/** A beat block is done exactly when every interval in it is. */
export const allBeatsDone = (beats: { index: number }[], count: number): boolean =>
  count > 0 && doneBeatIndices(beats, count).length === count;

/**
 * How each interval should read right now.
 *
 * `done` beats everything — a tick is a tick, whenever it landed. Otherwise
 * the day decides: on a past day every open interval is `past`, on a future
 * day `upcoming`, and today the current minute splits them. A null minute
 * (the client's first frame, before it knows the time) reads as upcoming
 * rather than guessing.
 *
 * There is deliberately no "missed" state. A past interval with nothing in it
 * is drawn quieter, never red: the feature exists to make the next one easy,
 * not to keep score of the last one.
 */
export type BeatState = "done" | "current" | "past" | "upcoming";

export function beatStates({
  span,
  minutes,
  done,
  day,
  nowMinute,
}: {
  span: Span;
  minutes: number;
  /** Indices already ticked. */
  done: number[];
  /** Where the block's date sits relative to today. */
  day: "past" | "today" | "future";
  nowMinute: number | null;
}): BeatState[] {
  const ticked = new Set(done);
  const current =
    day === "today" && nowMinute !== null
      ? beatIndexAt(span, minutes, nowMinute)
      : null;
  const startedBy =
    day === "today" && nowMinute !== null
      ? Math.floor((nowMinute - span.startMinute) / minutes)
      : null;

  return Array.from({ length: beatCount(span, minutes) }, (_, index) => {
    if (ticked.has(index)) return "done";
    if (day === "past") return "past";
    if (day === "future" || startedBy === null) return "upcoming";
    if (index === current) return "current";
    return index < startedBy ? "past" : "upcoming";
  });
}

/** "2026-10-12" against today's ISO date — string order is date order. */
export const dayRelation = (
  dateISO: string,
  todayISO: string,
): "past" | "today" | "future" =>
  dateISO === todayISO ? "today" : dateISO < todayISO ? "past" : "future";
