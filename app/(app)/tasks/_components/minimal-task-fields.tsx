"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeBar,
  UNIT_DESCRIPTIONS,
  type HabitUnit,
} from "@/lib/habit-bar";
import { cn } from "@/lib/utils";

const UNITS: { value: HabitUnit; label: string }[] = [
  { value: "MINUTES", label: "Minutes" },
  { value: "COUNT", label: "A count" },
];

/**
 * The one bar: the smallest version that counts.
 *
 * The framing here is the feature. The field is written like a promise — the
 * display face on a bare hairline, the way the timer writes the task title —
 * because the sentence typed into it *is* the habit's definition of done.
 * "Do the warmup" is a thing you can start, and starting is the expensive
 * part; "two minutes" was still a judgment call, and "workout" was a threat.
 *
 * The unit below it is not the bar. It only says what the optional log counts
 * once you keep going — and keeping going is never required.
 */
export function MinimalTaskFields({
  defaultUnit = "MINUTES",
  defaultMinimalTask = "",
  minimalTaskError,
}: {
  defaultUnit?: HabitUnit;
  defaultMinimalTask?: string;
  minimalTaskError?: string;
}) {
  const [unit, setUnit] = useState<HabitUnit>(defaultUnit);
  const [minimalTask, setMinimalTask] = useState(defaultMinimalTask);

  const trimmed = minimalTask.trim();

  return (
    <div className="space-y-5">
      <input type="hidden" name="unit" value={unit} />

      <div className="space-y-2">
        <Label
          htmlFor="minimalTask"
          className="text-micro text-muted-foreground font-medium tracking-wider uppercase"
        >
          The smallest version that counts
        </Label>
        <Input
          id="minimalTask"
          name="minimalTask"
          required
          maxLength={120}
          autoComplete="off"
          value={minimalTask}
          onChange={(event) => setMinimalTask(event.target.value)}
          placeholder="Do the warmup"
          aria-invalid={Boolean(minimalTaskError)}
          className="border-0 border-b border-input bg-transparent px-0 pb-2 shadow-none focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent"
        />
        <p className="text-muted-foreground text-label">
          {trimmed ? (
            <>
              <span className="text-foreground">{describeBar({ unit, minimalTask: trimmed })}</span>
              . Small enough for a bad day — one push-up, the warmup, one page.
            </>
          ) : (
            <>
              Do this and the day is done. Small enough for a bad day — one
              push-up, the warmup, one page.
            </>
          )}
        </p>
        {minimalTaskError && (
          <p role="alert" className="text-destructive text-label">
            {minimalTaskError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-label font-medium">
          Anything past it is just for you. Log it in:
        </Label>
        <div className="flex gap-1.5">
          {UNITS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setUnit(option.value)}
              aria-pressed={unit === option.value}
              className={cn(
                "focus-visible:ring-ring rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                unit === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-label">
          {UNIT_DESCRIPTIONS[unit]} Never required — there is no second bar.
        </p>
      </div>
    </div>
  );
}
