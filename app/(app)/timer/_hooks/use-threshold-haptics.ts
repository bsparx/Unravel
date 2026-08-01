"use client";

import { useEffect, useRef } from "react";

import { microProgress, type PlannedInterval } from "@/lib/timer-math";

/** Fractions remaining at which to pulse. Descending, and checked in order. */
const THRESHOLDS = [0.5, 0.1] as const;

/**
 * Somatic cues at the halfway and nearly-gone marks of the current interval.
 *
 * The face answers "how much is left" for anyone looking at it. This is for
 * everyone who has stopped looking at it — a short pulse at 50% and at 10% to
 * re-anchor attention that has already drifted, without the startle a sound
 * would carry. Sound stays reserved for the boundary that actually ends
 * something; see the chime in `timer-provider.tsx`.
 *
 * Deliberately quiet about failure: `navigator.vibrate` does not exist on iOS
 * Safari and can be refused anywhere. Both are fine. Nothing about the timer's
 * correctness depends on a pulse landing.
 */
export function useThresholdHaptics({
  enabled,
  running,
  intervalIndex,
  interval,
  intervalElapsedSeconds,
}: {
  enabled: boolean;
  running: boolean;
  intervalIndex: number;
  interval: PlannedInterval | undefined;
  intervalElapsedSeconds: number;
}) {
  // The previous reading, so a threshold fires on the *crossing* rather than on
  // being below it. A flag would fire the instant a half-spent session was
  // rehydrated from the server, which is a buzz for a moment that has already
  // passed.
  const previous = useRef<number | null>(null);

  // Resuming an interval must not re-fire what it already announced, but
  // starting a new one must. The index is the only thing that separates them.
  useEffect(() => {
    previous.current = null;
  }, [intervalIndex]);

  useEffect(() => {
    if (!enabled || !running) return;

    // Recovery's interval has a target of zero, and `microProgress` honestly
    // reports nothing remaining for it. Without this guard rest would buzz
    // twice the moment it began — the same trap the countdown guards in
    // `timer-provider.tsx` exist for.
    if (!interval || interval.targetSeconds <= 0) return;

    const remaining = microProgress(intervalElapsedSeconds, interval);
    const before = previous.current;
    previous.current = remaining;

    if (before === null) return;

    for (const threshold of THRESHOLDS) {
      if (before > threshold && remaining <= threshold) {
        pulse(threshold);
        break;
      }
    }
  }, [enabled, interval, intervalElapsedSeconds, running]);
}

/**
 * Short and blunt at halfway; a double, still short, when it is nearly gone.
 * Long buzzes read as alarms, and an alarm is the thing this is trying not to
 * be.
 */
function pulse(threshold: number) {
  const pattern = threshold <= 0.1 ? [30, 60, 30] : [35];
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Refused, or unsupported. A missed cue is not worth an error.
  }
}
