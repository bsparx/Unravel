"use client";

import { useState } from "react";
import { Clock, Flame, Minus, Moon, Plus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/info-tip";
import { formatDuration } from "@/lib/dates";
import {
  clampIntervals,
  clampTarget,
  MAX_INTERVALS,
  MODE_DESCRIPTIONS,
  sessionKind,
  suggestIntervals,
  type TimerConfig,
  type TimerMode,
  type WorkMode,
} from "@/lib/timer-math";
import { cn } from "@/lib/utils";

const MINUTE_PRESETS = [10, 15, 20, 25, 45, 60, 90];

export type ModeSwitcherProps = {
  config: TimerConfig;
  onChange: (next: Partial<TimerConfig>) => void;
  className?: string;
};

/**
 * Top pill switcher for picking timer mode (Pomodoro, Flow, Timer, Recovery).
 */
export function ModePills({
  config,
  onChange,
  className,
}: ModeSwitcherProps) {
  const [lastWork, setLastWork] = useState<{
    mode: WorkMode;
    targetSeconds: number;
    intervals: number;
  }>({
    mode: config.mode === "RECOVERY" ? "POMODORO" : config.mode,
    targetSeconds: config.mode === "RECOVERY" ? 1500 : config.targetSeconds,
    intervals: config.intervals,
  });

  const selectMode = (mode: TimerMode) => {
    if (mode === "RECOVERY") {
      if (config.mode !== "RECOVERY") {
        setLastWork({
          mode: config.mode,
          targetSeconds: config.targetSeconds,
          intervals: config.intervals,
        });
      }
      onChange({ mode: "RECOVERY", targetSeconds: 0, intervals: 1 });
    } else {
      const target =
        config.mode === "RECOVERY"
          ? lastWork.targetSeconds
          : config.targetSeconds;
      const intervals =
        mode === "POMODORO"
          ? suggestIntervals(target, config.focusSeconds)
          : 1;
      onChange({ mode, targetSeconds: target, intervals });
    }
  };

  const modes: { id: TimerMode; icon: typeof Zap; label: string }[] = [
    { id: "POMODORO", icon: Zap, label: "Pomodoro" },
    { id: "FLOW", icon: Flame, label: "Flow" },
    { id: "BASIC", icon: Clock, label: "Timer" },
    { id: "RECOVERY", icon: Moon, label: "Recovery" },
  ];

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Timer mode"
          className="grid grid-cols-2 items-center gap-1 rounded-xl border border-border/70 bg-card/80 p-1 sm:inline-flex"
        >
          {modes.map((item) => {
            const isSelected = config.mode === item.id;
            const Icon = item.icon;
            const isRest = item.id === "RECOVERY";

            return (
              <button
                key={item.id}
                aria-pressed={isSelected}
                type="button"
                onClick={() => selectMode(item.id)}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-label font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isSelected
                    ? isRest
                      ? "bg-rest text-rest-foreground font-semibold"
                      : "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <InfoTip term="timerModes" align="end" />
      </div>

      <p className="text-label text-muted-foreground text-center font-normal">
        {MODE_DESCRIPTIONS[config.mode]}
      </p>
    </div>
  );
}

/**
 * Compact horizontal dial for choosing duration presets, interval split, and adjustments.
 */
export function DurationDial({
  config,
  onChange,
  className,
}: ModeSwitcherProps) {
  const kind = sessionKind(config.mode);

  const setTarget = (seconds: number) => {
    const targetSeconds = clampTarget(seconds);
    onChange({
      targetSeconds,
      intervals:
        config.mode === "POMODORO"
          ? suggestIntervals(targetSeconds, config.focusSeconds)
          : 1,
    });
  };

  if (kind === "RECOVERY") {
    return (
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl border border-rest/30 bg-rest-muted/30 px-5 py-4 text-center transition-all",
          className,
        )}
      >
        <p className="text-title font-medium text-foreground">
          Open-ended rest
        </p>
        <p className="text-label text-muted-foreground mt-1">
          No countdown or finish line. Take the time you need to reset.
        </p>
      </div>
    );
  }

  const isPomodoro = config.mode === "POMODORO";
  const perFocusSeconds = Math.round(config.targetSeconds / config.intervals);

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4",
        className,
      )}
    >
      {/* Quick Duration Pills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium text-muted-foreground">
            {config.mode === "FLOW" ? "Target goal" : "Duration"}
          </span>
          <span className="font-mono text-micro text-muted-foreground tabular-nums">
            {formatDuration(config.targetSeconds)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {MINUTE_PRESETS.map((minutes) => {
            const isMatch = config.targetSeconds === minutes * 60;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => setTarget(minutes * 60)}
                aria-pressed={isMatch}
                className={cn(
                  "min-h-11 min-w-11 rounded-lg px-2 py-2 font-mono text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isMatch
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/40",
                )}
              >
                {minutes}m
              </button>
            );
          })}
        </div>
      </div>

      {/* Precision Stepper */}
      <div className="flex items-center justify-between border-t border-border/50 pt-3">
        <span className="text-label font-medium text-muted-foreground">
          Fine tune
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-border/80 hover:border-primary/50"
            aria-label="Five minutes less"
            onClick={() => setTarget(config.targetSeconds - 300)}
          >
            <Minus className="size-3.5" aria-hidden />
          </Button>

          <span className="min-w-16 text-center font-mono text-label font-medium tabular-nums">
            {formatDuration(config.targetSeconds)}
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-border/80 hover:border-primary/50"
            aria-label="Five minutes more"
            onClick={() => setTarget(config.targetSeconds + 300)}
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Pomodoro Interval Splitter */}
      {isPomodoro && (
        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex flex-col">
            <span className="text-label font-medium text-muted-foreground">
              Intervals
            </span>
            <span className="text-micro text-muted-foreground">
              {formatDuration(perFocusSeconds)} per block
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-border/80 hover:border-primary/50"
              aria-label="One session fewer"
              disabled={config.intervals <= 1}
              onClick={() =>
                onChange({ intervals: clampIntervals(config.intervals - 1) })
              }
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>

            <span className="min-w-16 text-center font-mono text-label font-medium tabular-nums">
              {config.intervals} {config.intervals === 1 ? "block" : "blocks"}
            </span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-border/80 hover:border-primary/50"
              aria-label="One session more"
              disabled={config.intervals >= MAX_INTERVALS}
              onClick={() =>
                onChange({ intervals: clampIntervals(config.intervals + 1) })
              }
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Combined ModeSwitcher component.
 */
export function ModeSwitcher({
  config,
  onChange,
  className,
}: ModeSwitcherProps) {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <ModePills config={config} onChange={onChange} />
      <DurationDial config={config} onChange={onChange} />
    </div>
  );
}
