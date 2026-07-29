"use client";

import { useState } from "react";
import { Minus, Moon, Plus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/lib/dates";
import {
  clampIntervals,
  clampTarget,
  MAX_INTERVALS,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  sessionKind,
  suggestIntervals,
  type TimerConfig,
  type WorkMode,
  WORK_MODES,
} from "@/lib/timer-math";
import { cn } from "@/lib/utils";

const MINUTE_PRESETS = [10, 20, 25, 45, 60, 90];

/**
 * The setup panel, shown only while the timer is idle. Once it's running the
 * configuration is locked — changing the plan mid-session would make the logged
 * session a different thing from the one that actually ran.
 */
export function ModeSwitcher({
  config,
  onChange,
}: {
  config: TimerConfig;
  onChange: (next: Partial<TimerConfig>) => void;
}) {
  // Remembered so that toggling Recovery → Work doesn't dump you back on
  // pomodoro with a zeroed target. Note clampTarget(0) returns 1500, so the
  // target has to be restored explicitly rather than left to the clamp.
  const [lastWork, setLastWork] = useState<{
    mode: WorkMode;
    targetSeconds: number;
    intervals: number;
  }>({
    mode: config.mode === "RECOVERY" ? "POMODORO" : config.mode,
    targetSeconds: config.mode === "RECOVERY" ? 1500 : config.targetSeconds,
    intervals: config.intervals,
  });

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

  const chooseWork = () => {
    onChange({
      mode: lastWork.mode,
      targetSeconds: lastWork.targetSeconds,
      intervals: lastWork.intervals,
    });
  };

  const chooseRecovery = () => {
    if (config.mode !== "RECOVERY") {
      setLastWork({
        mode: config.mode,
        targetSeconds: config.targetSeconds,
        intervals: config.intervals,
      });
    }
    // Recovery has no target. Zero is the honest value, and every consumer
    // guards on the mode rather than on the number.
    onChange({ mode: "RECOVERY", targetSeconds: 0, intervals: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Level one: the only choice that matters. Work and recovery are peers,
          which is the whole argument — rest isn't the reward for focus. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={chooseWork}
          aria-pressed={kind === "WORK"}
          className={cn(
            "focus-visible:ring-ring flex items-center justify-center gap-2 rounded-lg border p-3 text-title transition-colors focus-visible:ring-2 focus-visible:outline-none",
            kind === "WORK"
              ? "border-primary bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:border-primary/40",
          )}
        >
          <Zap className="size-4" aria-hidden />
          Work
        </button>
        <button
          type="button"
          onClick={chooseRecovery}
          aria-pressed={kind === "RECOVERY"}
          className={cn(
            "focus-visible:ring-ring flex items-center justify-center gap-2 rounded-lg border p-3 text-title transition-colors focus-visible:ring-2 focus-visible:outline-none",
            kind === "RECOVERY"
              ? "border-rest bg-rest-muted text-foreground"
              : "border-border text-muted-foreground hover:border-rest/40",
          )}
        >
          <Moon className="size-4" aria-hidden />
          Recovery
        </button>
      </div>

      {kind === "RECOVERY" ? (
        <p className="text-muted-foreground text-center text-label">
          No length to pick, and nothing to reach. It runs until you come back.
        </p>
      ) : (
        <WorkOptions
          config={config}
          onChange={onChange}
          setTarget={setTarget}
        />
      )}
    </div>
  );
}

/** The shape of a work session — one level down from the choice above. */
function WorkOptions({
  config,
  onChange,
  setTarget,
}: {
  config: TimerConfig;
  onChange: (next: Partial<TimerConfig>) => void;
  setTarget: (seconds: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Shape</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {WORK_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                onChange({
                  mode,
                  intervals:
                    mode === "POMODORO"
                      ? suggestIntervals(config.targetSeconds, config.focusSeconds)
                      : 1,
                })
              }
              aria-pressed={config.mode === mode}
              className={cn(
                "focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                config.mode === mode
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="block text-label font-medium">
                {MODE_LABELS[mode]}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-micro leading-4 tracking-normal normal-case">
                {MODE_DESCRIPTIONS[mode]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="timer-target" className="mb-2 block">
          {config.mode === "FLOW" ? "Goal" : "How long"}
        </Label>

        <div className="flex flex-wrap gap-1.5">
          {MINUTE_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => setTarget(minutes * 60)}
              aria-pressed={config.targetSeconds === minutes * 60}
              className={cn(
                "focus-visible:ring-ring rounded-full border px-3 py-1 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                config.targetSeconds === minutes * 60
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {minutes}m
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Five minutes less"
            onClick={() => setTarget(config.targetSeconds - 300)}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <span
            id="timer-target"
            className="w-24 text-center font-mono text-title tabular-nums"
          >
            {formatDuration(config.targetSeconds)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Five minutes more"
            onClick={() => setTarget(config.targetSeconds + 300)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {config.mode === "POMODORO" && (
        <div>
          <Label htmlFor="timer-intervals" className="mb-2 block">
            Split into
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One session fewer"
              disabled={config.intervals <= 1}
              onClick={() =>
                onChange({ intervals: clampIntervals(config.intervals - 1) })
              }
            >
              <Minus className="size-4" aria-hidden />
            </Button>
            <span
              id="timer-intervals"
              className="w-24 text-center font-mono text-title tabular-nums"
            >
              {config.intervals}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One session more"
              disabled={config.intervals >= MAX_INTERVALS}
              onClick={() =>
                onChange({ intervals: clampIntervals(config.intervals + 1) })
              }
            >
              <Plus className="size-4" aria-hidden />
            </Button>
            <span className="text-muted-foreground text-label">
              {formatDuration(
                Math.round(config.targetSeconds / config.intervals),
              )}{" "}
              each
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
