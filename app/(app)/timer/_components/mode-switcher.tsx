"use client";

import { useState } from "react";
import {
  ChevronDown,
  Clock,
  Minus,
  Moon,
  Plus,
  SlidersHorizontal,
  Waves,
  Zap,
} from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/dates";
import {
  buildIntervalPlan,
  CADENCE_PRESETS,
  clampBreak,
  clampIntervals,
  clampTarget,
  hasIntervals,
  MAX_BREAK_SECONDS,
  MAX_INTERVALS,
  MAX_TARGET_SECONDS,
  MIN_BREAK_SECONDS,
  MIN_TARGET_SECONDS,
  MODE_DESCRIPTIONS,
  perFocusSeconds,
  planTotalSeconds,
  sessionKind,
  suggestIntervals,
  type TimerConfig,
  type TimerMode,
  type WorkMode,
} from "@/lib/timer-math";
import { cn } from "@/lib/utils";

const BASIC_MINUTE_PRESETS = [10, 15, 25, 45, 60];

export type ModeSwitcherProps = {
  config: TimerConfig;
  onChange: (next: Partial<TimerConfig>) => void;
  className?: string;
};

/**
 * Mode selector (Pomodoro, Pomodoro Flow, Timer, Recovery).
 * Preserves work/break setup when moving between Pomodoro and Pomodoro Flow.
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
      return;
    }

    const fromRecovery = config.mode === "RECOVERY";
    const target = fromRecovery ? lastWork.targetSeconds : config.targetSeconds;

    // Switching between Pomodoro and Pomodoro Flow keeps the exact rounds &
    // baseline intact rather than resetting your cadence.
    const intervals = !hasIntervals(mode)
      ? 1
      : fromRecovery
        ? lastWork.intervals
        : hasIntervals(config.mode)
          ? config.intervals
          : suggestIntervals(target, config.focusSeconds);

    onChange({ mode, targetSeconds: target, intervals });
  };

  const modes: { id: TimerMode; icon: typeof Zap; label: string }[] = [
    { id: "POMODORO", icon: Zap, label: "Pomodoro" },
    { id: "FLOW", icon: Waves, label: "Pomodoro Flow" },
    { id: "BASIC", icon: Clock, label: "Timer" },
    { id: "RECOVERY", icon: Moon, label: "Recovery" },
  ];

  return (
    <div className={cn("flex w-full flex-col items-center gap-2.5", className)}>
      <div className="flex w-full max-w-full items-center justify-center gap-2">
        <div
          role="group"
          aria-label="Timer mode"
          className="grid w-full max-w-md grid-cols-2 items-center gap-1 rounded-[14px] border border-border/70 bg-muted/45 p-1 sm:inline-flex sm:w-auto sm:max-w-none"
        >
          {modes.map((item) => {
            const isSelected = config.mode === item.id;
            const Icon = item.icon;
            const isRest = item.id === "RECOVERY";
            const isFlow = item.id === "FLOW";

            return (
              <button
                key={item.id}
                aria-pressed={isSelected}
                type="button"
                onClick={() => selectMode(item.id)}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 py-2 text-label font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3.5",
                  isSelected
                    ? isRest
                      ? "bg-rest font-semibold text-rest-foreground shadow-xs"
                      : isFlow
                        ? "bg-flow font-semibold text-flow-foreground shadow-xs"
                        : "bg-primary font-semibold text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
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

      <p className="max-w-md text-center text-label leading-relaxed text-muted-foreground">
        {MODE_DESCRIPTIONS[config.mode]}
      </p>
    </div>
  );
}

/**
 * Effortless inline cadence strip + expandable fine-tune panel.
 *
 * For Pomodoro & Pomodoro Flow, puts 25/5, 50/10, 15/3, 45/10 one tap away
 * while keeping work baseline, break length, and round count clean and
 * decoupled (changing rounds adds rounds of the same baseline instead of
 * splitting 25m into awkward fractions).
 */
export function DurationDial({
  config,
  onChange,
  className,
}: ModeSwitcherProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const kind = sessionKind(config.mode);

  if (kind === "RECOVERY") {
    return (
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-rest/25 bg-rest-muted/35 px-5 py-3.5 text-center",
          className,
        )}
      >
        <p className="text-label text-muted-foreground">
          Open-ended rest — no countdown or finish line. Stop whenever you feel
          restored.
        </p>
      </div>
    );
  }

  const intervalMode = hasIntervals(config.mode);
  const isFlow = config.mode === "FLOW";
  const blockSeconds = perFocusSeconds(config);
  const rounds = clampIntervals(config.intervals);

  const applyCadence = (focusMinutes: number, breakMinutes: number) => {
    const focusSec = focusMinutes * 60;
    const breakSec = clampBreak(breakMinutes * 60);
    // Keep the chosen round count if it fits inside MAX_TARGET_SECONDS;
    // otherwise step rounds down cleanly rather than clamping the baseline.
    const maxRoundsForFocus = Math.max(
      1,
      Math.min(MAX_INTERVALS, Math.floor(MAX_TARGET_SECONDS / focusSec)),
    );
    const nextRounds = Math.min(rounds, maxRoundsForFocus);
    onChange({
      targetSeconds: clampTarget(focusSec * nextRounds),
      intervals: nextRounds,
      focusSeconds: focusSec,
      shortBreakSeconds: breakSec,
    });
  };

  const setBlockFocus = (nextFocusSeconds: number) => {
    const clampedBlock = Math.min(
      Math.floor(MAX_TARGET_SECONDS / rounds),
      Math.max(MIN_TARGET_SECONDS, Math.round(nextFocusSeconds)),
    );
    onChange({
      targetSeconds: clampTarget(clampedBlock * rounds),
      focusSeconds: clampedBlock,
    });
  };

  const setRounds = (nextCount: number) => {
    const clamped = clampIntervals(nextCount);
    const maxRoundsForBlock = Math.max(
      1,
      Math.min(MAX_INTERVALS, Math.floor(MAX_TARGET_SECONDS / blockSeconds)),
    );
    const safeRounds = Math.min(clamped, maxRoundsForBlock);
    onChange({
      intervals: safeRounds,
      targetSeconds: clampTarget(blockSeconds * safeRounds),
    });
  };

  const setBasicTarget = (seconds: number) => {
    onChange({
      targetSeconds: clampTarget(seconds),
      intervals: 1,
    });
  };

  const plan = buildIntervalPlan(config);
  const totalPlanSeconds = planTotalSeconds(plan);

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      {/* One-tap cadence or duration strip */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {intervalMode
          ? CADENCE_PRESETS.map((preset) => {
              const isMatch =
                blockSeconds === preset.focusMinutes * 60 &&
                config.shortBreakSeconds === preset.breakMinutes * 60;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={isMatch}
                  onClick={() =>
                    applyCadence(preset.focusMinutes, preset.breakMinutes)
                  }
                  className={cn(
                    "min-h-11 rounded-[10px] px-3 py-2 font-mono text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isMatch
                      ? isFlow
                        ? "border border-flow/40 bg-flow-muted font-semibold text-flow"
                        : "border border-primary/40 bg-accent font-semibold text-accent-foreground"
                      : "border border-border/65 bg-background/40 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              );
            })
          : BASIC_MINUTE_PRESETS.map((minutes) => {
              const isMatch = config.targetSeconds === minutes * 60;
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={isMatch}
                  onClick={() => setBasicTarget(minutes * 60)}
                  className={cn(
                    "min-h-11 min-w-12 rounded-[10px] px-3 py-2 font-mono text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isMatch
                      ? "border border-primary/40 bg-accent font-semibold text-accent-foreground"
                      : "border border-border/65 bg-background/40 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {minutes}m
                </button>
              );
            })}

        <button
          type="button"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border px-3 py-2 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            customOpen
              ? "border-border bg-muted text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <span>Customize</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-150",
              customOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>

      {/* Expandable customizer */}
      {customOpen && (
        <div className="animate-rise w-full max-w-md space-y-3.5 rounded-2xl border border-border/60 bg-muted/35 p-4">
          {intervalMode ? (
            <>
              {/* Work baseline stepper */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col text-left">
                  <span className="text-label font-medium text-foreground">
                    {isFlow ? "Work baseline" : "Focus block"}
                  </span>
                  <span className="text-micro text-muted-foreground">
                    {isFlow
                      ? "Flows freely past this mark"
                      : "Length of each focus round"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="Decrease work time"
                    disabled={blockSeconds <= MIN_TARGET_SECONDS}
                    onClick={() =>
                      setBlockFocus(
                        blockSeconds - (blockSeconds <= 600 ? 60 : 300),
                      )
                    }
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>

                  <span className="min-w-16 text-center font-mono text-label font-semibold tabular-nums">
                    {formatDuration(blockSeconds)}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="Increase work time"
                    disabled={
                      (blockSeconds + (blockSeconds < 600 ? 60 : 300)) * rounds >
                      MAX_TARGET_SECONDS
                    }
                    onClick={() =>
                      setBlockFocus(
                        blockSeconds + (blockSeconds < 600 ? 60 : 300),
                      )
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              {/* Break length stepper — always available so 25/5 works even on 1 round */}
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3.5">
                <div className="flex flex-col text-left">
                  <span className="text-label font-medium text-foreground">
                    Break
                  </span>
                  <span className="text-micro text-muted-foreground">
                    {isFlow
                      ? "Ready whenever you step away"
                      : "Rest between focus rounds"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="One minute less break"
                    disabled={config.shortBreakSeconds <= MIN_BREAK_SECONDS}
                    onClick={() =>
                      onChange({
                        shortBreakSeconds: clampBreak(
                          config.shortBreakSeconds - 60,
                        ),
                      })
                    }
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>

                  <span className="min-w-16 text-center font-mono text-label font-semibold tabular-nums">
                    {formatDuration(config.shortBreakSeconds)}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="One minute more break"
                    disabled={config.shortBreakSeconds >= MAX_BREAK_SECONDS}
                    onClick={() =>
                      onChange({
                        shortBreakSeconds: clampBreak(
                          config.shortBreakSeconds + 60,
                        ),
                      })
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              {/* Rounds stepper — cleanly aligned with Work & Break above */}
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3.5">
                <div className="flex flex-col text-left">
                  <span className="text-label font-medium text-foreground">
                    Rounds
                  </span>
                  <span className="text-micro text-muted-foreground">
                    {formatDuration(config.targetSeconds)} focus total
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="One round fewer"
                    disabled={rounds <= 1}
                    onClick={() => setRounds(rounds - 1)}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>

                  <span className="min-w-16 text-center font-mono text-label font-semibold tabular-nums">
                    {rounds} {rounds === 1 ? "round" : "rounds"}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-border/80 bg-background/50 hover:border-primary/50"
                    aria-label="One round more"
                    disabled={
                      rounds >= MAX_INTERVALS ||
                      blockSeconds * (rounds + 1) > MAX_TARGET_SECONDS
                    }
                    onClick={() => setRounds(rounds + 1)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              {/* Rhythm summary */}
              <p className="border-t border-border/50 pt-3 text-center font-mono text-micro text-muted-foreground">
                {isFlow
                  ? rounds === 1
                    ? `${formatDuration(blockSeconds)} baseline · ${formatDuration(config.shortBreakSeconds)} break ready if you continue`
                    : `${rounds} × ${formatDuration(blockSeconds)} baseline · ${formatDuration(config.shortBreakSeconds)} breaks · ${formatDuration(totalPlanSeconds)} planned`
                  : rounds === 1
                    ? `1 focus block · ${formatDuration(blockSeconds)}`
                    : `${rounds} × ${formatDuration(blockSeconds)} focus · ${formatDuration(config.shortBreakSeconds)} breaks · ${formatDuration(totalPlanSeconds)} total`}
              </p>
            </>
          ) : (
            /* Basic timer fine tune */
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col text-left">
                <span className="text-label font-medium text-foreground">
                  Fine tune
                </span>
                <span className="text-micro text-muted-foreground">
                  Adjust in 5-minute steps
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border/80 bg-background/50 hover:border-primary/50"
                  aria-label="Five minutes less"
                  disabled={config.targetSeconds <= MIN_TARGET_SECONDS}
                  onClick={() => setBasicTarget(config.targetSeconds - 300)}
                >
                  <Minus className="size-3.5" aria-hidden />
                </Button>

                <span className="min-w-16 text-center font-mono text-label font-semibold tabular-nums">
                  {formatDuration(config.targetSeconds)}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border/80 bg-background/50 hover:border-primary/50"
                  aria-label="Five minutes more"
                  disabled={config.targetSeconds >= MAX_TARGET_SECONDS}
                  onClick={() => setBasicTarget(config.targetSeconds + 300)}
                >
                  <Plus className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          )}
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
    <div className={cn("flex w-full flex-col items-center gap-4", className)}>
      <ModePills config={config} onChange={onChange} />
      <DurationDial config={config} onChange={onChange} />
    </div>
  );
}
