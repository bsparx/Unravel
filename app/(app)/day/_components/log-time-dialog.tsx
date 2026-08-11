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
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_FEEDBACK_PROMPT,
  MAX_FEEDBACK_LENGTH,
} from "@/lib/feedback";
import { MAX_MANUAL_LOG_MINUTES } from "@/lib/timer-math";
import type { TodayItem } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const PRESETS = [10, 15, 25, 45, 60];

/**
 * The tick's other half. A checkbox can't answer "how long did it take" or
 * "what did you actually get out of it", so this dialog asks whichever the
 * habit is missing:
 *
 * - **Time** (when nothing was logged): booking the honest figure before the
 *   tick lands, floored at the habit's own minimum and capped at ten hours —
 *   otherwise a DONE day with zero minutes behind it is a hole in every
 *   average and habit tier downstream.
 * - **Feedback** (when the habit requires it and no note exists): the written
 *   note is the *condition* of completion, and the custom prompt is the
 *   reminder of what to write.
 *
 * The readout is drawn like the timer face — a static ring with JetBrains
 * Mono counting up inside it. Nothing sweeps, only the digits move, and the
 * digits are the truth.
 */
export function LogTimeDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: TodayItem;
  onConfirm: (result: { minutes?: number; note?: string }) => void;
  onCancel: () => void;
}) {
  const needsTime = item.loggedSeconds === 0 && !item.done;
  const needsFeedback = item.requiresFeedback && !item.feedbackNote;
  const prompt = item.feedbackPrompt || DEFAULT_FEEDBACK_PROMPT;

  const floor = item.minimumMinutes;
  const max = MAX_MANUAL_LOG_MINUTES;

  const [raw, setRaw] = useState<string>(String(floor));
  const [note, setNote] = useState<string>(item.feedbackNote ?? "");

  const parsed = Number(raw);
  const timeValid =
    raw.trim() !== "" && Number.isInteger(parsed) && parsed >= floor && parsed <= max;
  const noteValid =
    !needsFeedback ||
    (note.trim() !== "" && note.trim().length <= MAX_FEEDBACK_LENGTH);
  const valid = timeValid && noteValid;
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

  const heading = needsFeedback
    ? "Close it with a note"
    : "How long did that take?";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription className="text-label">
            {needsFeedback ? (
              <>
                Ticking off &ldquo;{item.title}&rdquo; waits on the note — the
                day only counts once it&apos;s written.
              </>
            ) : (
              <>
                You ticked off &ldquo;{item.title}&rdquo; without the timer
                running. Log the real time so today&apos;s stats stay honest.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {item.requiresFeedback && (
          <div className="space-y-2">
            <label
              htmlFor="feedback-note"
              className="font-display block text-title"
            >
              {prompt}
            </label>
            <Textarea
              id="feedback-note"
              name="note"
              rows={3}
              maxLength={MAX_FEEDBACK_LENGTH}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="A line is enough — but it has to be a real one."
              className={cn(
                !noteValid && "border-destructive",
              )}
            />
            <p
              className={cn(
                "text-right text-micro tabular-nums",
                note.trim().length > MAX_FEEDBACK_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {note.trim().length > MAX_FEEDBACK_LENGTH
                ? `${note.length} / ${MAX_FEEDBACK_LENGTH} — over the limit`
                : `${note.length} / ${MAX_FEEDBACK_LENGTH}`}
            </p>
          </div>
        )}

        {needsTime && (
          <>
            {/* The readout: the timer face, stopped at what you're claiming. */}
            <div
              className="relative mx-auto grid size-36 place-items-center"
              aria-hidden
            >
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
                <span className="text-muted-foreground mt-1.5 block text-label">
                  min
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap justify-center gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRaw(String(preset))}
                    aria-pressed={timeValid && shown === preset}
                    className={cn(
                      "focus-visible:ring-ring rounded-full border px-3 py-1 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      timeValid && shown === preset
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
                  onBlur={() => !timeValid && setRaw(String(floor))}
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
          </>
        )}

        {needsTime && (
          <p className="text-muted-foreground text-center text-micro">
            {constraint}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Go back
          </Button>
          <Button
            type="button"
            disabled={!valid}
            onClick={() =>
              valid &&
              onConfirm({
                ...(needsTime ? { minutes: parsed } : {}),
                ...(item.requiresFeedback && note.trim() ? { note: note.trim() } : {}),
              })
            }
          >
            {needsTime
              ? `Log ${formatBooked(shown)} & mark done`
              : "Save & mark done"}
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
