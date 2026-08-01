"use client";

import { cn } from "@/lib/utils";
import type { Transition } from "@/lib/transitions";

/**
 * The switch between two blocks, drawn.
 *
 * Everywhere else a calendar leaves this space blank, which says the gap is the
 * absence of a plan. It isn't — it is where a plan most reliably comes apart.
 * Stopping one thing and starting another takes a length of time, and a day
 * with none of it allotted fails at the first switch and cascades from there.
 *
 * Kept quiet on purpose. It is a hairline and a number, not a block: this marks
 * the day's give, and give that shouts is just more to look at. The only one
 * that raises its voice is the switch with no room in it at all.
 */
export function TransitionStrip({
  transition,
  minutePx,
}: {
  transition: Transition;
  /** The grid's pixels-per-minute, so this can't drift from the blocks. */
  minutePx: number;
}) {
  const flush = transition.kind === "none";
  const height = Math.max(2, transition.minutes * minutePx);

  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 z-10 flex items-center justify-center"
      style={{
        top: transition.startMinute * minutePx - (flush ? 1 : 0),
        height: flush ? 2 : height,
      }}
      aria-hidden
    >
      {flush ? (
        // Nothing to label — there is no time here. The line is the whole
        // message: these two things touch, and you will be late for the second.
        <div className="bg-destructive/70 h-0.5 w-full rounded-full" />
      ) : (
        <div
          className={cn(
            "flex w-full items-center gap-1.5 overflow-hidden",
            // Under about 12 minutes there is no room for the label between the
            // blocks, so it drops out and the rule carries it alone.
            height < 12 && "justify-center",
          )}
        >
          <span
            className={cn(
              "h-px flex-1",
              transition.kind === "tight"
                ? "bg-destructive/40"
                : "bg-border",
            )}
          />
          {height >= 12 && (
            <span
              className={cn(
                "text-micro shrink-0 tabular-nums",
                transition.kind === "tight"
                  ? "text-destructive/80"
                  : "text-muted-foreground/70",
              )}
            >
              {transition.minutes}m
            </span>
          )}
          <span
            className={cn(
              "h-px flex-1",
              transition.kind === "tight"
                ? "bg-destructive/40"
                : "bg-border",
            )}
          />
        </div>
      )}
    </div>
  );
}
