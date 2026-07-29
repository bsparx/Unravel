"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pause, Play } from "lucide-react";

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
  const { state, elapsedSeconds, toggle } = useTimer();

  const live = state.phase === "RUNNING" || state.phase === "PAUSED";
  if (!live || pathname.startsWith("/timer")) return null;

  const running = state.phase === "RUNNING";
  const recovery = state.config.mode === "RECOVERY";

  // One rule, shared with the timer screen: flow's overrun, recovery counting
  // up and a plain countdown are all the same function.
  const readout = formatClock(
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
        "fixed right-4 bottom-40 z-50 flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 shadow-sm md:top-4 md:right-6 md:bottom-auto",
        recovery
          ? "border-rest/40 bg-rest-muted"
          : running
            ? "border-running/40 bg-running-muted"
            : "border-border bg-card",
      )}
    >
      <Link
        href="/timer"
        className="focus-visible:ring-ring flex items-center gap-2 rounded-full pr-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            running
              ? cn(
                  "animate-breathe motion-reduce:animate-none",
                  recovery ? "bg-rest" : "bg-running",
                )
              : "bg-muted-foreground",
          )}
          aria-hidden
        />
        <span className="font-mono text-label tabular-nums">{readout}</span>
        {state.task && (
          <span className="text-muted-foreground hidden max-w-32 truncate text-label sm:inline">
            {state.task.title}
          </span>
        )}
      </Link>

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
    </div>
  );
}
