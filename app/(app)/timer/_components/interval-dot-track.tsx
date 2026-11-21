"use client";

import { Check, Coffee, Waves } from "lucide-react";
import { formatDuration } from "@/lib/dates";
import type { PlannedInterval, TimerMode } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

export type IntervalDotTrackProps = {
  plan: PlannedInterval[];
  intervalIndex: number;
  mode: TimerMode;
  running: boolean;
  idle: boolean;
  onBreak: boolean;
  flowing?: boolean;
  flowSeconds?: number;
  className?: string;
};

/**
 * Spatial progression bar for multi-round Pomodoro and Pomodoro Flow sessions.
 * Shows the sequence of focus rounds and breaks without ambient motion.
 */
export function IntervalDotTrack({
  plan,
  intervalIndex,
  mode,
  idle,
  onBreak,
  flowing = false,
  flowSeconds = 0,
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
  const firstBreak = plan.find((interval) => interval.kind !== "FOCUS");
  const totalFocusSeconds = focusBlocks.reduce(
    (sum, block) => sum + block.targetSeconds,
    0,
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2",
        className,
      )}
      role="region"
      aria-label={`${mode === "FLOW" ? "Pomodoro Flow" : "Pomodoro"} rounds: round ${idle ? 1 : activeFocusCount} of ${focusBlocks.length}`}
    >
      <div className="max-w-full overflow-x-auto px-1 py-1">
        <div className="flex w-max items-center gap-1.5 sm:gap-2">
          {focusBlocks.map((block, idx) => {
            const isDone = !idle && idx < currentFocusIndex;
            const isCurrent = !idle && idx === currentFocusIndex && !onBreak;
            const isCurrentFlowing = isCurrent && flowing;
            const isBreakAfterThis =
              !idle && idx === currentFocusIndex && onBreak;

            return (
              <div
                key={block.index}
                className="flex shrink-0 items-center gap-1.5 sm:gap-2"
              >
                {/* Focus Round Pill */}
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all duration-200",
                    isCurrent
                      ? "h-7 gap-1.5 px-3 font-mono text-micro font-semibold"
                      : "size-6",
                    isDone
                      ? mode === "FLOW"
                        ? "border border-flow/30 bg-flow-muted text-flow"
                        : "border border-primary/30 bg-primary/15 text-accent-foreground"
                      : isCurrentFlowing
                        ? "bg-flow text-flow-foreground ring-2 ring-flow/30"
                        : isCurrent
                          ? "bg-running text-running-foreground ring-2 ring-running/30"
                          : isBreakAfterThis
                            ? "border border-border bg-muted text-muted-foreground"
                            : "border border-border/60 bg-muted/40 text-muted-foreground/75",
                  )}
                  title={`Round ${idx + 1}: ${formatDuration(block.targetSeconds)}`}
                >
                  {isDone ? (
                    <Check className="size-3 stroke-[2.5]" aria-hidden />
                  ) : isCurrentFlowing ? (
                    <>
                      <Waves className="size-3" aria-hidden />
                      <span>#{idx + 1}</span>
                    </>
                  ) : isCurrent ? (
                    <>
                      <span className="size-1.5 rounded-full bg-current" />
                      <span>#{idx + 1}</span>
                    </>
                  ) : (
                    <span className="font-mono text-micro font-medium">
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Break connector between rounds */}
                {idx < focusBlocks.length - 1 && (
                  <div className="flex items-center gap-1 text-muted-foreground/45">
                    <div
                      className={cn(
                        "h-0.5 w-3 rounded-full transition-colors sm:w-4",
                        isDone
                          ? mode === "FLOW"
                            ? "bg-flow/40"
                            : "bg-primary/40"
                          : isBreakAfterThis
                            ? "bg-rest/70"
                            : "bg-border/60",
                      )}
                    />
                    {isBreakAfterThis && (
                      <Coffee
                        className="size-3 text-rest"
                        aria-label="On break"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Micro legend */}
      <p className="font-mono text-micro tracking-tight text-muted-foreground">
        {idle
          ? `${focusBlocks.length} rounds · ${formatDuration(focusBlocks[0]?.targetSeconds ?? 1500)}${firstBreak ? ` / ${formatDuration(firstBreak.targetSeconds)}` : ""} · ${formatDuration(totalFocusSeconds)} work`
          : onBreak
            ? `Break · round ${currentFocusIndex + 2} of ${focusBlocks.length} up next`
            : flowing
              ? `Round ${currentFocusIndex + 1} of ${focusBlocks.length} · in flow${flowSeconds >= 60 ? ` (+${formatDuration(flowSeconds)})` : ""}`
              : `Round ${currentFocusIndex + 1} of ${focusBlocks.length}`}
      </p>
    </div>
  );
}
