"use client";

import { Coffee, Check } from "lucide-react";
import { formatDuration } from "@/lib/dates";
import type { PlannedInterval } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

export type IntervalDotTrackProps = {
  plan: PlannedInterval[];
  intervalIndex: number;
  running: boolean;
  idle: boolean;
  onBreak: boolean;
  className?: string;
};

/**
 * Spatial progression bar for multi-block Pomodoro sessions.
 * Visualizes the sequence of focus intervals and breaks at a glance,
 * giving ADHD users a clear, dopamine-rich sense of progress.
 */
export function IntervalDotTrack({
  plan,
  intervalIndex,
  running,
  idle,
  onBreak,
  className,
}: IntervalDotTrackProps) {
  const focusBlocks = plan.filter((interval) => interval.kind === "FOCUS");

  if (focusBlocks.length <= 1) {
    return null;
  }

  // Count of focus intervals that have elapsed or are currently active
  const activeFocusCount = plan
    .slice(0, intervalIndex + 1)
    .filter((interval) => interval.kind === "FOCUS").length;

  const currentFocusIndex = Math.max(0, activeFocusCount - 1);
  const currentInterval = plan[Math.min(intervalIndex, plan.length - 1)];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
      role="region"
      aria-label={`Pomodoro intervals: block ${idle ? 1 : activeFocusCount} of ${focusBlocks.length}`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5">
        {focusBlocks.map((block, idx) => {
          const isDone = !idle && idx < currentFocusIndex;
          const isCurrent = !idle && idx === currentFocusIndex && !onBreak;
          const isBreakAfterThis =
            !idle && idx === currentFocusIndex && onBreak;
          const isUpcoming = idle || idx > currentFocusIndex;

          return (
            <div key={block.index} className="flex items-center gap-2 sm:gap-2.5">
              {/* Focus Block Indicator */}
              <div
                className={cn(
                  "group relative flex items-center justify-center rounded-full transition-all duration-300",
                  // Sizing and shape
                  isCurrent
                    ? "h-7 px-3 gap-1.5 ring-2 ring-running/30 shadow-sm"
                    : "size-6",
                  // Colors
                  isDone
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : isCurrent
                      ? "bg-running text-running-foreground font-mono text-xs font-semibold"
                      : isBreakAfterThis
                        ? "bg-muted text-muted-foreground border border-border"
                        : "bg-muted/40 text-muted-foreground/60 border border-border/60",
                )}
                title={`Block ${idx + 1}: ${formatDuration(block.targetSeconds)}`}
              >
                {isDone ? (
                  <Check className="size-3 stroke-[2.5]" aria-hidden />
                ) : isCurrent ? (
                  <>
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[0.6875rem]">#{idx + 1}</span>
                  </>
                ) : (
                  <span className="font-mono text-[0.625rem] font-medium">
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Break spacer between blocks */}
              {idx < focusBlocks.length - 1 && (
                <div className="flex items-center gap-1 text-muted-foreground/40">
                  <div
                    className={cn(
                      "h-0.5 w-3 sm:w-4 rounded-full transition-colors",
                      isDone
                        ? "bg-primary/40"
                        : isBreakAfterThis
                          ? "bg-destructive/60 animate-pulse"
                          : "bg-border/60",
                    )}
                  />
                  {isBreakAfterThis && (
                    <Coffee
                      className="size-3 text-destructive animate-bounce"
                      aria-label="On break"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Micro legend */}
      <p className="font-mono text-micro text-muted-foreground/70 tracking-tight">
        {idle
          ? `${focusBlocks.length} blocks · ${formatDuration(focusBlocks[0]?.targetSeconds ?? 1500)} each`
          : onBreak
            ? `Break time · next is block ${currentFocusIndex + 2}`
            : `Focus block ${currentFocusIndex + 1} of ${focusBlocks.length}`}
      </p>
    </div>
  );
}
