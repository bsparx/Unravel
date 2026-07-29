"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [10, 20, 25, 45, 60];

/**
 * "How long do you want to spend on this?" in minutes, because that is the unit
 * people actually think in. Everything downstream stores seconds.
 *
 * Presets first, stepper second, free text last — deciding between five options
 * is much cheaper than typing a number.
 */
export function DurationPicker({
  name,
  defaultMinutes,
  id,
  className,
}: {
  name: string;
  defaultMinutes?: number | null;
  id?: string;
  className?: string;
}) {
  const [minutes, setMinutes] = useState<number | "">(defaultMinutes ?? "");

  const step = (delta: number) => {
    setMinutes((current) => {
      const base = typeof current === "number" ? current : 0;
      return Math.min(480, Math.max(0, base + delta)) || "";
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setMinutes(minutes === preset ? "" : preset)}
            aria-pressed={minutes === preset}
            className={cn(
              "focus-visible:ring-ring rounded-full border px-3 py-1 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
              minutes === preset
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {preset}m
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Five minutes less"
          onClick={() => step(-5)}
        >
          <Minus className="size-4" aria-hidden />
        </Button>
        <Input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          max={480}
          placeholder="No estimate"
          value={minutes}
          onChange={(event) => {
            const next = event.target.value;
            setMinutes(next === "" ? "" : Number(next));
          }}
          className="w-28 text-center tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Five minutes more"
          onClick={() => step(5)}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
        <span className="text-muted-foreground text-label">minutes</span>
      </div>
    </div>
  );
}
