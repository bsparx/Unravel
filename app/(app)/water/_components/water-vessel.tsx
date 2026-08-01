"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import { logGlass } from "../actions";
import {
  expectedByNow,
  formatMinuteOfDay,
  paceMarkerMinute,
  waterStatusLine,
  type WaterSettings,
} from "@/lib/water";
import { cn } from "@/lib/utils";

/**
 * The day as a column of water.
 *
 * The timer's signature is a ring that drains; this is its rhyme — a vessel
 * that fills. The day starts empty and one tap anywhere on it raises the
 * level one notch, which is the entire interaction. The count is the only
 * number on the page worth making big, so it gets the mono display and the
 * app's one overshoot: a `pop` on the way up only — logging a glass is a
 * tick-off moment, removing one is a correction and should not bounce.
 *
 * The dashed line is the pace line: where the day *should* be by now, with
 * the clock time it belongs to. It is the one quiet thing on the vessel,
 * because the fill is the statement.
 */
export function WaterVessel({
  dateISO,
  settings,
  glasses,
  lastTimeMin,
  initialNowMinute,
  timezone,
}: {
  dateISO: string;
  settings: WaterSettings;
  glasses: number;
  lastTimeMin: number | null;
  initialNowMinute: number;
  timezone: string;
}) {
  const [, startTransition] = useTransition();
  const [shown, applyDelta] = useOptimistic(glasses, (current, delta: number) =>
    Math.max(0, current + delta),
  );

  // "Now" starts at the server's answer so the first paint hydrates clean,
  // and ticks every thirty seconds after that.
  const [nowMinute, setNowMinute] = useState(initialNowMinute);
  useEffect(() => {
    const id = setInterval(
      () => setNowMinute(minuteOfDayNow(timezone)),
      30_000,
    );
    return () => clearInterval(id);
  }, [timezone]);

  const log = () => {
    startTransition(async () => {
      applyDelta(1);
      const formData = new FormData();
      formData.set("date", dateISO);
      await logGlass(formData);
    });
  };

  const goal = settings.goal;
  const expected = expectedByNow(
    goal,
    settings.startMin,
    settings.endMin,
    nowMinute,
  );
  const ratio = Math.min(1, Math.max(0, shown / goal));
  const paceMinute = paceMarkerMinute(
    goal,
    expected,
    settings.startMin,
    settings.endMin,
  );
  const status = waterStatusLine({
    glasses: shown,
    goal,
    expected,
    lastTimeMin,
    nowMinute,
  });

  const prevShown = useRef(shown);
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    if (shown > prevShown.current) setPopKey((key) => key + 1);
    prevShown.current = shown;
  }, [shown]);

  const notches = [];
  for (let k = 1; k < goal; k++) notches.push(k);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={log}
        aria-label="Log a glass of water"
        className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="bg-muted/60 border-border relative h-72 w-24 overflow-hidden rounded-b-xl border">
          {/* The day's volume marks — one line per glass. Covered by the fill
              as the level rises, which is the point: they exist to be
              crossed. */}
          {notches.map((k) => (
            <span
              key={k}
              aria-hidden
              className="border-border/50 absolute inset-x-0 border-t"
              style={{ top: `${(1 - k / goal) * 100}%` }}
            />
          ))}

          {/* The water itself. Fills from the bottom, never drains from the
              top — a glass is drunk up, but the day accumulates down. */}
          <span
            aria-hidden
            className={cn(
              "bg-primary absolute inset-x-0 bottom-0 rounded-t-[3px] transition-[height] duration-300",
              "motion-reduce:transition-none",
            )}
            style={{ height: `${Math.round(ratio * 100)}%` }}
          />

          {/* The pace line, and the clock time it belongs to. */}
          {paceMinute !== null && (
            <span
              aria-hidden
              className="border-muted-foreground/40 absolute inset-x-0 border-t-2 border-dashed"
              style={{ top: `${(1 - expected / goal) * 100}%` }}
            />
          )}
          {paceMinute !== null && (
            <span
              aria-hidden
              className="bg-background/90 text-muted-foreground absolute right-1 rounded-sm px-1 font-mono text-micro tabular-nums"
              style={{
                top: `${(1 - expected / goal) * 100}%`,
                transform: "translateY(-100%)",
              }}
            >
              {formatMinuteOfDay(paceMinute)}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-col items-center gap-1">
        <p
          aria-live="polite"
          className="text-display font-mono leading-none tabular-nums"
        >
          <span key={popKey} className={cn("inline-block", popKey > 0 && "animate-pop")}>
            {shown}
          </span>
          <span className="text-muted-foreground">/{goal}</span>
        </p>
        <p
          className={cn(
            "text-label",
            shown >= goal ? "text-primary" : "text-muted-foreground",
          )}
        >
          {status}
        </p>
      </div>
    </div>
  );
}

/** Minutes since midnight, in the user's timezone. */
function minuteOfDayNow(timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return value("hour") * 60 + value("minute");
}
