"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_MANUAL_LOG_MINUTES } from "@/lib/timer-math";
import type { TodayItem } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const PRESETS = [10, 15, 25, 45, 60];

/**
 * "How long did that take?" — the other half of the tick.
 *
 * Ticking a task done on a day where nothing was logged would leave a hole in
 * the stats: a DONE row with zero minutes behind it. This dialog asks for the
 * honest figure before the tick lands, floored at the task's own minimum and
 * capped at ten hours.
 *
 * The readout is drawn like the timer face — a static ring with JetBrains
 * Mono counting up inside it. That is the app's established way to show a
 * number that is a claim rather than a countdown (the recovery face does the
 * same): nothing sweeps, only the digits move, and the digits are the truth.
 */
export function LogTimeDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: TodayItem;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}) {
  const floor = item.minimumMinutes;
  const max = MAX_MANUAL_LOG_MINUTES;

  const [raw, setRaw] = useState<string>(String(floor));

  const parsed = Number(raw);
  const valid =
    raw.trim() !== "" && Number.isInteger(parsed) && parsed >= floor && parsed <= max;
  const shown = Math.min(max, Math.max(floor, Number.isFinite(parsed) ? parsed : floor));

  const presets = useMemo(() => {
    const list = PRESETS.filter((preset) => preset >= floor && preset <= max);
    if (!list.includes(floor)) list.unshift(floor);
    return list;
  }, [floor, max]);

  const step = (delta: number) =>
    setRaw(String(Math.min(max, Math.max(floor, shown + delta))));

  const constraint =
    floor >= max
      ? "Ten hours — the maximum."
      : `At least ${floor} min · up to 10 hours`;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How long did that take?</DialogTitle>
          <DialogDescription className="text-label">
            You ticked off &ldquo;{item.title}&rdquo; without the timer running.
            Log the real time so today&apos;s stats stay honest.
          </DialogDescription>
        </DialogHeader>

        {/* The readout: the timer face, stopped at what you're claiming. */}
        <div className="relative mx-auto grid size-36 place-items-center" aria-hidden>
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="var(--arc-track)"
              strokeWidth="5"
            />
          </svg>
          <div className="text-center">
            <span className="tnum font-mono text-primary block text-4xl leading-none font-medium">
              {shown}
            </span>
            <span className="text-muted-foreground mt-1.5 block text-label">min</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap justify-center gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRaw(String(preset))}
                aria-pressed={valid && shown === preset}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  valid && shown === preset
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {preset}m
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Five minutes less"
              onClick={() => step(-5)}
              disabled={shown <= floor}
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={floor}
              max={max}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              onBlur={() => !valid && setRaw(String(floor))}
              aria-label="Minutes to log"
              className="tnum font-mono w-20 text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Five minutes more"
              onClick={() => step(5)}
              disabled={shown >= max}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-micro">
          {constraint}
        </p>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Go back
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => valid && onConfirm(parsed)}
          >
            Log {formatBooked(shown)} &amp; mark done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "25m" / "1h 30m" / "10h" — the app's own duration shorthand. */
function formatBooked(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }
  return `${minutes}m`;
}
