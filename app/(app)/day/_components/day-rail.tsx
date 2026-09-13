"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { useNowMinute } from "@/hooks/use-now-minute";
import {
  blockLabel,
  blockTaskSummary,
  claimedMinutes,
  formatMinuteOfDay,
  formatMinuteLength,
} from "@/lib/block-math";
import type { CalendarBlock } from "@/lib/time-blocks";
import { cn } from "@/lib/utils";

/** The stretch of day the rail covers. Same window PlanStrip used. */
const FROM = 6 * 60;
const TO = 23 * 60;
/** Ticks every hour; labels every third, so the rail stays quiet. */
const TICK_HOURS = Array.from({ length: 18 }, (_, i) => 6 + i);
const LABEL_HOURS = [6, 9, 12, 15, 18, 21];

const KIND_FILL = {
  WORK: "bg-primary/70",
  RECOVERY: "bg-rest/70",
  BUFFER: "bg-muted-foreground/25",
  // Filtered out before /day ever sees one — kept so the map stays exhaustive.
  DAYDREAM: "bg-violet-400/40",
} as const;

/**
 * Today's plan as one horizontal rail — the page's Time Timer.
 *
 * The old strip was a glance; this is the same glance with a body. Hour ticks
 * and labels make the day measurable, the blocks keep their kind vocabulary
 * (teal work, slate recovery, dashed-grey buffer), the "start here" pick is
 * pinned to its own minute, and the running-blue line carries a chip that
 * says what time it actually is — the one number the line could never speak.
 * The reservation holds: the chip is a clock, the only running blue here.
 *
 * The block layer draws in once on load — the same single orchestrated
 * moment, under the same narrow licence, the calendar's week strips hold.
 */
export function DayRail({
  blocks,
  dateISO,
  upNextMinute,
  timezone,
}: {
  blocks: CalendarBlock[];
  dateISO: string;
  /** The anchor minute of the "start here" pick, pinned onto the rail. */
  upNextMinute: number | null;
  timezone: string;
}) {
  const nowMinute = useNowMinute(timezone);

  const span = TO - FROM;
  const position = (minute: number) =>
    `${((Math.min(Math.max(minute, FROM), TO) - FROM) / span) * 100}%`;

  const claimed = claimedMinutes(blocks);
  const showNow =
    nowMinute !== null && nowMinute >= FROM && nowMinute <= TO;

  return (
    <Link
      href={`/calendar?view=day&date=${dateISO}`}
      aria-label={`Today's plan: ${
        blocks.length === 0
          ? "nothing blocked out yet"
          : `${formatMinuteLength(claimed)} claimed across ${blocks.length} block${
              blocks.length === 1 ? "" : "s"
            }`
      }. Open it on the calendar.`}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring animate-rise group mb-8 block rounded-xl border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div
        aria-hidden
        className="mb-2 flex items-baseline justify-between gap-3"
      >
        <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          <CalendarDays className="mr-1.5 inline size-3" />
          Today&apos;s plan
        </p>
        <p className="text-muted-foreground text-label tabular-nums">
          {blocks.length === 0 ? (
            <span className="group-hover:text-primary">
              Nothing blocked out — plan it
            </span>
          ) : (
            <>
              {formatMinuteLength(claimed)} claimed across {blocks.length}{" "}
              block{blocks.length === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      {/* The rail. Decorative — the link's aria-label carries the meaning. */}
      <div aria-hidden className="relative h-12">
        {/* The track the spans sit on. */}
        <div className="bg-muted/50 border-border/60 absolute inset-x-0 inset-y-2 rounded-full border" />

        {/* Hour ticks. */}
        {TICK_HOURS.map((hour) => (
          <div
            key={hour}
            className="border-border/70 absolute inset-y-2.5 w-px border-l"
            style={{ left: position(hour * 60) }}
          />
        ))}

        {/* The plan, drawn in left to right. */}
        <div className="animate-draw absolute inset-x-0 inset-y-1.5 origin-left">
          {blocks.map((block) => (
            <div
              key={block.id}
              title={[
                formatMinuteOfDay(block.startMinute),
                blockTaskSummary(block) || blockLabel(block),
              ].join(" ")}
              className={cn(
                "absolute inset-y-0 rounded-full",
                KIND_FILL[block.kind],
                block.completedAt && "opacity-45",
              )}
              style={{
                left: position(block.startMinute),
                width: `calc(${position(block.endMinute)} - ${position(
                  block.startMinute,
                )})`,
              }}
            />
          ))}
        </div>

        {/* The "start here" pick, pinned to its own minute. */}
        {upNextMinute !== null && (
          <span
            className="bg-primary absolute top-1 size-1.5 -translate-x-1/2 rounded-full ring-2 ring-card"
            style={{ left: position(upNextMinute) }}
          />
        )}

        {/* Now. The chip is the only running blue that speaks. */}
        {showNow && (
          <div
            className="absolute inset-y-0 z-20 w-0"
            style={{ left: position(nowMinute!) }}
          >
            <div className="bg-running absolute inset-y-0 left-0 w-px" />
            <span className="bg-running text-running-foreground absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 font-mono text-[0.625rem] leading-none tabular-nums">
              {formatMinuteOfDay(nowMinute!)}
            </span>
          </div>
        )}
      </div>

      {/* Hour labels, every third tick. */}
      <div aria-hidden className="relative mt-1 h-3">
        {LABEL_HOURS.map((hour) => (
          <span
            key={hour}
            className="text-muted-foreground/70 absolute top-0 -translate-x-1/2 font-mono text-[0.625rem] tabular-nums"
            style={{ left: position(hour * 60) }}
          >
            {formatMinuteOfDay(hour * 60)}
          </span>
        ))}
      </div>
    </Link>
  );
}
