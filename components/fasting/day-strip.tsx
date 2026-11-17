"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MINUTES_PER_DAY, eatMinutes, fastMinutes, formatHM, formatMinuteOfDay, type FastWindow } from "@/lib/fasting";

const pct = (minute: number) => `${(minute / MINUTES_PER_DAY) * 100}%`;

/**
 * The day as one bar, midnight to midnight: the eating window shaded, the
 * rest is the fast, and a hairline for now. A window that runs past
 * midnight is drawn as its two pieces, at the end and the start of the bar.
 */
export function DayStrip({
  window,
  nowMinute = null,
  eatLabel: eatName = "Eating window",
  fastLabel: fastName = "Fasting",
  className,
}: {
  window: FastWindow;
  /** What the shaded part and the rest are called; Islamic days rename them. */
  eatLabel?: string;
  fastLabel?: string;
  /** Minute of the local day, or null to leave the marker out. */
  nowMinute?: number | null;
  className?: string;
}) {
  const { eatStart, eatEnd } = window;
  const pieces =
    eatStart < eatEnd
      ? [[eatStart, eatEnd]]
      : [
          [eatStart, MINUTES_PER_DAY],
          [0, eatEnd],
        ];
  const eatLabel = `${eatName}, ${formatMinuteOfDay(eatStart)} to ${formatMinuteOfDay(eatEnd)} (${formatHM(eatMinutes(window))})`;
  const fastLabel = `${fastName}, ${formatMinuteOfDay(eatEnd)} to ${formatMinuteOfDay(eatStart)} (${formatHM(fastMinutes(window))})`;

  return (
    <div className={cn("w-full", className)}>
      <div
        role="img"
        aria-label={`${eatLabel}. ${fastLabel}.`}
        className="relative h-3 rounded-full bg-[var(--fast-track)]"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span aria-hidden className="absolute inset-0 rounded-full" />
          </TooltipTrigger>
          <TooltipContent side="top">{fastLabel}</TooltipContent>
        </Tooltip>
        {pieces.map(([from, to]) => (
          <Tooltip key={from}>
            <TooltipTrigger asChild>
              <span
                aria-hidden
                className="absolute inset-y-0 rounded-full border border-[var(--fast-eat-edge)] bg-[var(--fast-eat)]"
                style={{ left: pct(from), width: pct(to - from) }}
              />
            </TooltipTrigger>
            <TooltipContent side="top">{eatLabel}</TooltipContent>
          </Tooltip>
        ))}
        {nowMinute !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-[var(--fast-now)]"
            style={{ left: pct(nowMinute) }}
          />
        )}
      </div>
      <div aria-hidden className="relative mt-1.5 h-4 font-mono text-[0.65rem] tabular-nums text-[var(--woop-ink-muted)]">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span
            key={hour}
            className={cn(
              "absolute",
              hour === 0 ? "left-0" : hour === 24 ? "right-0" : "-translate-x-1/2",
            )}
            style={hour > 0 && hour < 24 ? { left: pct(hour * 60) } : undefined}
          >
            {String(hour).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}
