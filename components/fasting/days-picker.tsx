"use client";

import { WEEKDAYS } from "@/lib/dates";
import { FAST_DAY_PRESETS, describeFastDays, normalizeFastDays } from "@/lib/fasting";
import { cn } from "@/lib/utils";

/**
 * Pick which weekdays you fast on (0 = Sun .. 6 = Sat). Shared between
 * Settings and the Fasting plan popover on /body. Unscheduled days hold the
 * Fasting scene steady instead of deducting a stage.
 */
export function FastDaysPicker({
  value,
  onChange,
}: {
  value: readonly number[];
  onChange: (days: number[]) => void;
}) {
  const selected = normalizeFastDays(value);
  const selectedSet = new Set(selected);

  const toggleDay = (day: number) => {
    if (selectedSet.has(day)) {
      if (selected.length <= 1) return;
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day].sort((a, b) => a - b));
    }
  };

  const matchesPreset = (days: readonly number[]) =>
    days.length === selected.length && days.every((d, i) => selected[i] === d);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FAST_DAY_PRESETS.map((preset) => {
          const active = matchesPreset(preset.days);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange([...preset.days])}
              className={cn(
                "focus-visible:ring-ring rounded-full border px-3 py-1 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="Fasting days of the week" className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => {
          const active = selectedSet.has(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              aria-label={day.long}
              onClick={() => toggleDay(day.value)}
              className={cn(
                "focus-visible:ring-ring flex min-h-10 flex-col items-center justify-center rounded-xl border text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{day.short}</span>
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-micro">
        {describeFastDays(selected)} — off-schedule days hold your scene steady.
      </p>
    </div>
  );
}
