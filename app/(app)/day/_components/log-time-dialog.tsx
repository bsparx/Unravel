"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  JournalSpreadDialog,
  type SpreadEntry,
} from "@/components/journal-spread";
import {
  DEFAULT_FEEDBACK_PROMPT,
  MAX_FEEDBACK_LENGTH,
} from "@/lib/feedback";
import { MAX_MANUAL_LOG_MINUTES } from "@/lib/timer-math";
import type { TodayItem } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const PRESETS = [10, 15, 25, 45, 60];

/**
 * The tick's other half, and the optional log's only door. A checkbox can't
 * answer "how long did that take" or "what did you actually get out of it",
 * so this dialog asks whichever is missing — on the right page of the day's
 * journal spread (see components/journal-spread.tsx), with the rest of the
 * day's notes on the left:
 *
 * - **Time** (`needsTime`, decided by the caller): the honest figure beside
 *   the day's claim. For a todo it is the honesty ask at tick time — a DONE
 *   day with zero minutes behind it is a hole in every average. For a habit
 *   it is "log the rest": purely optional, because the claim alone is the day
 *   and nothing is measured against a target any more.
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
  needsTime,
  dateLabel,
  dayIndex,
  onConfirm,
  onCancel,
}: {
  item: TodayItem;
  /** Ask for the optional (or honesty) time figure. False = notes only. */
  needsTime: boolean;
  /** Already formatted — the spread's left page header. */
  dateLabel: string;
  /** The whole day, notes included, for the spread's left page. */
  dayIndex: SpreadEntry[];
  onConfirm: (result: { minutes?: number; note?: string }) => void;
  onCancel: () => void;
}) {
  const needsFeedback = item.requiresFeedback && !item.feedbackNote;
  const prompt = item.feedbackPrompt || DEFAULT_FEEDBACK_PROMPT;

  const floor = 1;
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
    : item.type === "HABIT"
      ? "Log the rest"
      : "How long did that take?";

  const blurb = needsFeedback ? (
    <>
      Ticking off &ldquo;{item.title}&rdquo; waits on the note — the day only
      counts once it&apos;s written.
    </>
  ) : item.type === "HABIT" ? (
    <>
      Just for you: the optional log beside today&apos;s claim. The day already
      counts — this never changes that.
    </>
  ) : (
    <>
      You ticked off &ldquo;{item.title}&rdquo; without the timer running. Log
      the real time so today&apos;s stats stay honest.
    </>
  );

  return (
    <JournalSpreadDialog
      dateLabel={dateLabel}
      heading={heading}
      blurb={blurb}
      prompt={item.requiresFeedback ? prompt : undefined}
      dayIndex={dayIndex}
      note={note}
      onNoteChange={setNote}
      showNote={item.requiresFeedback}
      noteRequired={needsFeedback}
      confirmLabel={
        needsTime ? `Log ${formatBooked(shown)} & mark done` : "Save & mark done"
      }
      confirmDisabled={!valid}
      onConfirm={() =>
        valid &&
        onConfirm({
          ...(needsTime ? { minutes: parsed } : {}),
          ...(item.requiresFeedback && note.trim() ? { note: note.trim() } : {}),
        })
      }
      onCancel={onCancel}
    >
      {needsTime && (
        <>
          {/* The readout: the timer face, stopped at what you're claiming. */}
          <div
            className="relative mx-auto mt-4 grid size-36 place-items-center"
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
              <span className="text-paper-ink-muted mt-1.5 block text-label">
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
                      : "border-paper-edge text-paper-ink-muted hover:border-primary/50 hover:text-paper-ink",
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
                className="border-paper-edge text-paper-ink"
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
                className="tnum font-mono border-paper-edge text-paper-ink w-20 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Five minutes more"
                onClick={() => step(5)}
                disabled={shown >= max}
                className="border-paper-edge text-paper-ink"
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>

          <p className="text-paper-ink-muted mt-2 text-center text-micro">
            {constraint}
          </p>
        </>
      )}
    </JournalSpreadDialog>
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
