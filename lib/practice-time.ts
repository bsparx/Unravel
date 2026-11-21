/**
 * Assigned time durations for every Mind and Heart practice — pure, no React,
 * no Prisma, shared between statistics queries, UI hints, and verification tests.
 *
 * Rules:
 *   - Meditation:       actual time meditated (sum of `MeditationSession.seconds`)
 *   - WOOP:             10 minutes static when rehearsed that day
 *   - Disputation:      10 minutes static when written or revisited that day
 *   - Gratitude & Du'a: depends on the template used (`lib/practices.ts`), using
 *                       the actual item count for counted templates
 *   - Daily recitation: 5 minutes static when completed that day
 *   - Brain dump:       actual duration clamped to 1–10 minutes per dump
 *                       (paper dumps without a logged duration default to 5 min)
 *   - Reading:          user-logged minutes per sitting, or 10 minutes assumed
 *                       when left blank
 */

import type { HeartTab } from "@/lib/heart-tabs";
import type { MindTab } from "@/lib/mind-tabs";
import {
  PRACTICE_DEFAULT_COUNT,
  clampCount,
  readItems,
  templateLabel,
  templateOrDefault,
  type PracticeKind,
} from "@/lib/practices";
import { READING_DEFAULT_MINUTES } from "@/lib/reading";

export const WOOP_SECONDS = 10 * 60;
export const DISPUTATION_SECONDS = 10 * 60;
export const RECITATION_SECONDS = 5 * 60;

export const BRAIN_DUMP_MIN_SECONDS = 60;
export const BRAIN_DUMP_MAX_SECONDS = 10 * 60;
export const BRAIN_DUMP_DEFAULT_SECONDS = 5 * 60;

export const READING_DEFAULT_SECONDS = READING_DEFAULT_MINUTES * 60;

/** Compact rule hints shown in the Statistics item selector. */
export const MIND_TIME_HINTS: Record<MindTab, string> = {
  braindump: "1–10m",
  meditate: "Actual",
  reading: "Logged / 10m",
  wishes: "10m",
  disputations: "10m",
};

export const HEART_TIME_HINTS: Record<HeartTab, string> = {
  gratitude: "By template",
  dua: "By template",
  recitation: "5m",
};

/** Meditation: actual time meditated, never negative. */
export function meditationPracticeSeconds(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.round(totalSeconds);
}

/** WOOP: 10 minutes static on any day a wish was rehearsed. */
export function woopPracticeSeconds(rehearsalCount: number): number {
  return rehearsalCount > 0 ? WOOP_SECONDS : 0;
}

/** Disputation (ABCDE): 10 minutes static on any day one was written or revisited. */
export function disputationPracticeSeconds(activityCount: number): number {
  return activityCount > 0 ? DISPUTATION_SECONDS : 0;
}

/** Daily recitation: 5 minutes static on any day the set was completed. */
export function recitationPracticeSeconds(completed: boolean): number {
  return completed ? RECITATION_SECONDS : 0;
}

export type JournalPracticeDuration = {
  templateId: string;
  templateName: string;
  /** e.g. "Good things · 5" or "With its adab". */
  label: string;
  minutes: number;
  seconds: number;
};

/**
 * Gratitude & Du'a: credited minutes come directly from the template saved on
 * the entry (`lib/practices.ts`), using the actual item count for counted
 * templates ("Good things", "Du'as"). Legacy rows with no stored template fall
 * back to the practice's default template.
 */
export function journalPracticeDuration(
  kind: PracticeKind,
  templateId: string | null | undefined,
  rawItems: unknown,
): JournalPracticeDuration {
  const template = templateOrDefault(kind, templateId);
  const items = readItems(rawItems);
  const count =
    items.length > 0 ? clampCount(items.length) : PRACTICE_DEFAULT_COUNT;
  const minutes = Math.max(1, Math.round(template.minutes(count)));

  return {
    templateId: template.id,
    templateName: template.name,
    label: templateLabel(template, count),
    minutes,
    seconds: minutes * 60,
  };
}

/**
 * Brain dump: 1–10 minutes based on how long you actually did it.
 * Legacy paper dumps saved with 0 seconds default to 5 minutes (the standard
 * length); typed dumps with any recorded seconds clamp cleanly to 1–10 min.
 */
export function brainDumpEntrySeconds(entry: {
  seconds: number;
  paper: boolean;
}): number {
  const raw = Number.isFinite(entry.seconds) ? Math.round(entry.seconds) : 0;
  if (raw <= 0) {
    return entry.paper ? BRAIN_DUMP_DEFAULT_SECONDS : BRAIN_DUMP_MIN_SECONDS;
  }
  return Math.min(
    BRAIN_DUMP_MAX_SECONDS,
    Math.max(BRAIN_DUMP_MIN_SECONDS, raw),
  );
}

export function brainDumpDaySeconds(
  entries: readonly { seconds: number; paper: boolean }[],
): number {
  let total = 0;
  for (const entry of entries) total += brainDumpEntrySeconds(entry);
  return total;
}

/**
 * Reading: uses the user's logged minutes when provided, otherwise assumes
 * 10 minutes for that sitting.
 */
export function readingEntryDuration(entry: {
  minutes: number | null | undefined;
}): { seconds: number; assumed: boolean } {
  if (
    typeof entry.minutes === "number" &&
    Number.isFinite(entry.minutes) &&
    entry.minutes > 0
  ) {
    return { seconds: Math.round(entry.minutes) * 60, assumed: false };
  }
  return { seconds: READING_DEFAULT_SECONDS, assumed: true };
}

export function readingDayDuration(
  entries: readonly { minutes: number | null | undefined }[],
): { seconds: number; assumedCount: number; allAssumed: boolean } {
  let seconds = 0;
  let assumedCount = 0;
  for (const entry of entries) {
    const res = readingEntryDuration(entry);
    seconds += res.seconds;
    if (res.assumed) assumedCount += 1;
  }
  return {
    seconds,
    assumedCount,
    allAssumed: entries.length > 0 && assumedCount === entries.length,
  };
}
