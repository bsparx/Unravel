"use client";

import { useEffect, useRef, useState } from "react";

import {
  reminderDue,
  waterReminderBody,
  type WaterSettings,
} from "@/lib/water";

/**
 * Tells you to drink water, in the one channel that reaches another app.
 *
 * Same posture as `useReturnNotification`, applied to a repeating need:
 *
 * - **Permission is asked when reminders are first enabled**, never on page
 *   load. Browsers give you exactly one prompt; a denial can't be re-asked,
 *   so the request has to happen at the moment it's legible.
 * - **The goal being met is the day's end.** A notification budget that never
 *   runs out gets the app muted at the OS level, which costs every future
 *   alert as well as this one. The day is a session, and sessions close.
 * - **On pace means silence.** The reminders exist to catch the day that fell
 *   behind the line, not to narrate the one that didn't.
 * - **One per interval slot, replacing rather than stacking.** The last
 *   notified minute is persisted per day, so navigating the app (which
 *   remounts this) can't produce a burst of "you forgot" for a day the hook
 *   has already said it in.
 *
 * The honest limitation, shared with the break alerts: this only runs while
 * an Unravel tab is open. A closed app is out of reach of anything but a
 * service worker, and that is infra this app deliberately doesn't have.
 */
export function useWaterReminder({
  settings,
  dateISO,
  glasses,
  lastTimeMin,
  timezone,
}: {
  settings: WaterSettings;
  dateISO: string;
  glasses: number;
  lastTimeMin: number | null;
  timezone: string;
}) {
  const [nowMinute, setNowMinute] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());

      const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

      setNowMinute(value("hour") * 60 + value("minute"));
    };

    read();
    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Ask once, and only once the person has actually turned reminders on.
  const askedForPermission = useRef(false);

  useEffect(() => {
    if (!settings.remindersEnabled || askedForPermission.current) return;
    if (!supported() || Notification.permission !== "default") return;

    askedForPermission.current = true;
    // Fire-and-forget: the answer is read from `Notification.permission` when
    // there is something to say, so a pending prompt blocks nothing.
    void Notification.requestPermission().catch(() => {
      // Refused, or unavailable in this context. Nothing here is load-bearing.
    });
  }, [settings.remindersEnabled]);

  // The last minute a reminder was spent on this day. Persisted per date so a
  // remount (every navigation remounts the provider) can't re-nag a day the
  // hook has already spoken to. A new day starts with a clean slate.
  const lastNotifiedMin = useRef<number | null>(null);

  useEffect(() => {
    lastNotifiedMin.current = readStored(dateISO);
  }, [dateISO]);

  useEffect(() => {
    if (nowMinute === null || !settings.remindersEnabled) return;
    if (!supported() || Notification.permission !== "granted") return;
    if (!reminderDue(settings, nowMinute, glasses, lastNotifiedMin.current)) {
      return;
    }

    lastNotifiedMin.current = nowMinute;
    store(dateISO, nowMinute);

    notify(settings, glasses, lastTimeMin, nowMinute);
  }, [nowMinute, settings, dateISO, glasses, lastTimeMin]);
}

const supported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window;

function notify(
  settings: WaterSettings,
  glasses: number,
  lastTimeMin: number | null,
  nowMinute: number,
) {
  const body = waterReminderBody({
    goal: settings.goal,
    glasses,
    lastTimeMin,
    nowMinute,
  });

  try {
    new Notification("Time for water", {
      body,
      // Replaces the previous one rather than stacking. A pile of water
      // reminders is noise, and noise is what gets an app muted.
      tag: "unravel-water",
      renotify: true,
    } as NotificationOptions);
  } catch {
    // Some browsers throw for constructed notifications outside a service
    // worker. Nothing here is load-bearing — the vessel and the day row
    // still say it.
  }
}

function readStored(dateISO: string): number | null {
  try {
    const raw = window.localStorage.getItem(`unravel-water:${dateISO}`);
    const value = raw === null ? null : Number(raw);
    return value !== null && Number.isFinite(value) ? value : null;
  } catch {
    // Private mode or a blocked store. Degrades to "no memory", which means
    // at most one extra reminder — acceptable.
    return null;
  }
}

function store(dateISO: string, minute: number) {
  try {
    window.localStorage.setItem(`unravel-water:${dateISO}`, String(minute));
  } catch {
    // Same degradation as above.
  }
}
