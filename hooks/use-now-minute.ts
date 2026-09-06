"use client";

import { useEffect, useState } from "react";

/**
 * Minutes since local midnight in `timeZone`, ticking every 30 seconds.
 *
 * Null until the first client tick, on purpose: the server has no "now" the
 * client can agree with to the minute, and rendering a moving marker at a
 * server-computed minute would be a guaranteed hydration mismatch. Consumers
 * treat null as "not yet" and render nothing that moves. The same contract as
 * the calendar's NowProvider and the water row's pace tick — this is the
 * shared hook behind all of them.
 */
export function useNowMinute(timeZone: string): number | null {
  const [minute, setMinute] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());

      const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

      setMinute(value("hour") * 60 + value("minute"));
    };

    read();
    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);

  return minute;
}
