import Link from "next/link";
import { CalendarDays } from "lucide-react";

import {
  claimedMinutes,
  formatMinuteLength,
  formatMinuteOfDay,
  MINUTES_PER_DAY,
} from "@/lib/block-math";
import type { CalendarBlock } from "@/lib/time-blocks";
import { cn } from "@/lib/utils";

/** The stretch of day the strip covers. Outside it, nothing is drawn. */
const FROM = 6 * 60;
const TO = 23 * 60;

const KIND_FILL = {
  WORK: "bg-primary/70",
  RECOVERY: "bg-rest/70",
  BUFFER: "bg-muted-foreground/25",
  // Filtered out before /day ever sees one — kept so the map stays exhaustive.
  DAYDREAM: "bg-violet-400/40",
} as const;

/**
 * Today's plan, as one horizontal bar.
 *
 * Not a second calendar — a glance. The question it answers is "is today
 * already full?", which is the one thing worth knowing before you add another
 * task to it, and the one thing a list view structurally cannot tell you.
 */
export function PlanStrip({
  blocks,
  dateISO,
  nowMinute,
}: {
  blocks: CalendarBlock[];
  dateISO: string;
  nowMinute: number | null;
}) {
  const span = TO - FROM;
  const position = (minute: number) =>
    `${((Math.min(Math.max(minute, FROM), TO) - FROM) / span) * 100}%`;

  const claimed = claimedMinutes(blocks);

  return (
    <Link
      href={`/calendar?view=day&date=${dateISO}`}
      className="border-border bg-card hover:border-primary/40 focus-visible:ring-ring group block rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          <CalendarDays className="mr-1.5 inline size-3" aria-hidden />
          Today&apos;s plan
        </p>
        <p className="text-muted-foreground text-label tabular-nums">
          {blocks.length === 0 ? (
            <span className="group-hover:text-primary">
              Nothing blocked out — plan it
            </span>
          ) : (
            <>
              {formatMinuteLength(claimed)} claimed across {blocks.length} block
              {blocks.length === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>

      <div className="bg-muted/60 relative h-3 w-full overflow-hidden rounded-full">
        {blocks.map((block) => (
          <div
            key={block.id}
            title={`${formatMinuteOfDay(block.startMinute)} ${block.title}`}
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

        {nowMinute !== null && nowMinute >= FROM && nowMinute <= TO && (
          <div
            className="bg-running absolute inset-y-0 w-px"
            style={{ left: position(nowMinute) }}
            aria-hidden
          />
        )}
      </div>

      <div className="text-muted-foreground mt-1 flex justify-between text-micro tabular-nums">
        <span>{formatMinuteOfDay(FROM)}</span>
        <span>{formatMinuteOfDay(Math.round((FROM + TO) / 2))}</span>
        <span>{formatMinuteOfDay(TO % MINUTES_PER_DAY)}</span>
      </div>
    </Link>
  );
}
