"use client";

import { useEffect, useRef } from "react";

/**
 * Minutes into the overrun at which to say something again.
 *
 * Escalating rather than repeating, and deliberately not a single alert at the
 * boundary. One notification at the moment the break ends is the worst possible
 * timing: the failure this exists for is not "I never heard it", it is "I heard
 * it and carried on scrolling". The thing that has to persist is the reminder,
 * not the volume.
 *
 * It stops at the last entry. Something that never stops gets muted at the OS
 * level, which costs every future alert as well as this one.
 */
const FOLLOW_UPS_MINUTES = [2, 5, 10, 20] as const;

type Options = {
  enabled: boolean;
  /** Whether a break is past its time right now. */
  overrunning: boolean;
  /** Whether a break is on the clock at all — when to ask for permission. */
  onBreak: boolean;
  /** Seconds past the break's target. */
  overrunSeconds: number;
  /** What the person was in the middle of. Becomes the notification body. */
  returnNote: string | null;
};

/**
 * Tells you the break is over, in the one channel that reaches another app.
 *
 * Sound and haptics reach you in the room. A break that runs away is not spent
 * in the room — it is spent in a different tab or a different app, where this
 * page is not rendering and its chime has already been and gone.
 *
 * Permission is requested when a break *starts*, never on page load. A prompt
 * that arrives cold is a prompt that gets dismissed, and browsers only give you
 * the one: a denial cannot be re-asked for from the page. Asking at the moment
 * the request is legible is the whole difference between the feature working
 * and it being permanently off.
 */
export function useReturnNotification({
  enabled,
  overrunning,
  onBreak,
  overrunSeconds,
  returnNote,
}: Options) {
  // Ask once per break, and only once the break is actually running.
  const askedForBreak = useRef(false);

  useEffect(() => {
    if (!onBreak) {
      askedForBreak.current = false;
      return;
    }
    if (askedForBreak.current || !enabled) return;
    if (!supported() || Notification.permission !== "default") return;

    askedForBreak.current = true;
    // Fire-and-forget: the answer is read from `Notification.permission` when
    // there is something to say, so a pending prompt blocks nothing.
    void Notification.requestPermission().catch(() => {
      // Refused, or unavailable in this context. Nothing here is load-bearing.
    });
  }, [enabled, onBreak]);

  // Which alerts have already been spent on this overrun. Cleared when the
  // break ends, or when it stops overrunning because time was added on purpose.
  const sent = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!overrunning) sent.current.clear();
  }, [overrunning]);

  useEffect(() => {
    if (!enabled || !overrunning) return;
    if (!supported() || Notification.permission !== "granted") return;

    // The boundary itself is step 0; the rest are the follow-ups.
    const due = [0, ...FOLLOW_UPS_MINUTES.map((m) => m * 60)].filter(
      (mark) => overrunSeconds >= mark && !sent.current.has(mark),
    );
    const mark = due.at(-1);
    if (mark === undefined) return;

    // Mark every step up to here, not just the one being sent. A tab that was
    // asleep through three of them should produce one notification on waking,
    // not a burst of three.
    for (const step of [0, ...FOLLOW_UPS_MINUTES.map((m) => m * 60)]) {
      if (step <= mark) sent.current.add(step);
    }

    notify(mark, returnNote);
  }, [enabled, overrunning, overrunSeconds, returnNote]);
}

const supported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

function notify(mark: number, returnNote: string | null) {
  const title =
    mark === 0 ? "Break's over" : `Break's over — ${Math.round(mark / 60)} min ago`;

  try {
    new Notification(title, {
      body: returnNote ?? "Back to it.",
      // Replaces the previous one rather than stacking. Four notifications
      // about the same break is noise, and noise is what gets an app muted.
      tag: "unravel-break-over",
      renotify: true,
    } as NotificationOptions);
  } catch {
    // Some browsers throw for constructed notifications outside a service
    // worker. Nothing here is load-bearing — the badge and the face still say it.
  }
}
