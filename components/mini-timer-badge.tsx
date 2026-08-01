"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Pause, Play } from "lucide-react";

import { useTimer } from "@/app/(app)/timer/_hooks/timer-provider";
import { formatClock } from "@/lib/dates";
import { readoutSeconds } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

/**
 * A live session is easy to forget about the moment you navigate away, which
 * for this audience is the difference between a logged hour and a mystery. This
 * keeps the clock on screen everywhere except the timer itself.
 */
export function MiniTimerBadge() {
  const pathname = usePathname();
  const {
    state,
    elapsedSeconds,
    overrunSeconds,
    isOverrunning,
    skipInterval,
    toggle,
  } = useTimer();

  const live = state.phase === "RUNNING" || state.phase === "PAUSED";
  if (!live || pathname.startsWith("/timer")) return null;

  const running = state.phase === "RUNNING";
  const recovery = state.config.mode === "RECOVERY";

  // One rule, shared with the timer screen: flow's overrun, recovery counting
  // up and a plain countdown are all the same function. A break past its time
  // is the exception, because it is the one case where the number people need
  // is how far over they are rather than how far through.
  const readout = isOverrunning
    ? `+${formatClock(overrunSeconds)}`
    : formatClock(
        readoutSeconds(
          state.config.mode,
          elapsedSeconds,
          state.config.targetSeconds,
        ),
      );

  return (
    <div
      className={cn(
        // On mobile this stacks above the capture button, which now shares the
        // right-hand rail; on desktop it moves out of the way entirely.
        "fixed right-4 bottom-40 z-50 flex items-center gap-1 border py-1 pr-1 pl-3 shadow-sm md:top-4 md:right-6 md:bottom-auto",
        // An overrun changes the badge's *shape*, not only its tint. A
        // recoloured pill reads as the same state in a different mode, and this
        // is the one state that has to be legible from the corner of an eye
        // while you are looking at something else entirely.
        isOverrunning
          ? "border-destructive bg-destructive text-background rounded-lg"
          : "rounded-full",
        !isOverrunning &&
          (recovery
            ? "border-rest/40 bg-rest-muted"
            : running
              ? "border-running/40 bg-running-muted"
              : "border-border bg-card"),
      )}
    >
      <Link
        href="/timer"
        className="focus-visible:ring-ring flex items-center gap-2 rounded-full pr-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isOverrunning
              ? "bg-background"
              : running
                ? cn(
                    "animate-breathe motion-reduce:animate-none",
                    recovery ? "bg-rest" : "bg-running",
                  )
                : "bg-muted-foreground",
          )}
          aria-hidden
        />
        <span className="font-mono text-label tabular-nums">{readout}</span>
        {/* The cue, not the task title: what you were in the middle of is the
            thing that makes coming back cheap. Falls back to the title, which
            is at least better than nothing. */}
        {(state.returnNote ?? state.task?.title) && (
          <span
            className={cn(
              "hidden max-w-32 truncate text-label sm:inline",
              isOverrunning ? "text-background/80" : "text-muted-foreground",
            )}
          >
            {state.returnNote ?? state.task?.title}
          </span>
        )}
      </Link>

      {/* Overrunning, the useful button is not pause — it is the one that ends
          the break. Pausing here would freeze the clock on a break that has
          already run over, which is precisely how the overrun used to become
          invisible. */}
      {isOverrunning ? (
        <button
          type="button"
          onClick={skipInterval}
          aria-label="End the break and get back to it"
          className="focus-visible:ring-ring hover:bg-background/20 rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? "Pause the timer" : "Resume the timer"}
          className="focus-visible:ring-ring hover:bg-background/60 rounded-full p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {running ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
