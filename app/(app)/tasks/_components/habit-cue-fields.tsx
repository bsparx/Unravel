"use client";

import { useState } from "react";
import { Coffee, Link2, Minus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeStack } from "@/lib/habit-cue";
import { cn } from "@/lib/utils";

export type CueMode = "none" | "habit" | "label";

type Anchor = { id: string; title: string };

const MODES: { value: CueMode; label: string; icon: typeof Link2 }[] = [
  { value: "none", label: "Nothing yet", icon: Minus },
  { value: "habit", label: "Another habit", icon: Link2 },
  { value: "label", label: "Something I already do", icon: Coffee },
];

/**
 * Habit stacking — the trigger that comes immediately before this habit.
 *
 * The two anchor kinds are deliberately presented as equals rather than as "a
 * habit" and "other". A cue you already do without thinking is the *better*
 * anchor of the two: it needs no willpower, which is exactly why it can carry
 * something that does. Tracking it would add a streak to protect and turn a free
 * trigger into a second obligation, so a label anchor stays untracked on
 * purpose — no quota, no statistics, nothing to break.
 *
 * The live recipe line is the point of the whole field. "After pouring my
 * morning tea, I will meditate." is a sentence you can act on; a form with an
 * "anchor" dropdown is not.
 */
export function HabitCueFields({
  habits,
  habitTitle,
  defaultMode = "none",
  defaultTaskId = null,
  defaultLabel = null,
  defaultMinutes = 5,
  taskIdError,
  labelError,
}: {
  /** Candidate habit anchors. The habit being edited is already excluded. */
  habits: Anchor[];
  /** What's currently in the title field, for the recipe preview. */
  habitTitle: string;
  defaultMode?: CueMode;
  defaultTaskId?: string | null;
  defaultLabel?: string | null;
  defaultMinutes?: number;
  taskIdError?: string;
  labelError?: string;
}) {
  const [mode, setMode] = useState<CueMode>(defaultMode);
  const [taskId, setTaskId] = useState(defaultTaskId ?? "");
  const [label, setLabel] = useState(defaultLabel ?? "");
  const [minutes, setMinutes] = useState<number | "">(defaultMinutes);

  const anchorTitle =
    mode === "habit"
      ? (habits.find((habit) => habit.id === taskId)?.title ?? null)
      : mode === "label"
        ? label.trim() || null
        : null;

  const recipe = describeStack(anchorTitle, habitTitle);

  return (
    <div className="space-y-4">
      <input type="hidden" name="cueMode" value={mode} />
      {/* Only the active mode's value is submitted. The server discriminates on
          cueMode, but sending a stale label alongside a habit anchor would leave
          a field that means nothing sitting in the payload. */}
      {mode === "habit" && (
        <input type="hidden" name="cueTaskId" value={taskId} />
      )}
      {mode === "label" && <input type="hidden" name="cueLabel" value={label} />}
      {mode !== "none" && (
        <input type="hidden" name="cueMinutes" value={minutes === "" ? 5 : minutes} />
      )}

      <div className="flex flex-wrap gap-1.5">
        {MODES.map((option) => {
          const Icon = option.icon;
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={active}
              className={cn(
                "focus-visible:ring-ring flex items-center gap-1.5 rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <Icon className="size-3" aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>

      {mode === "habit" && (
        <div className="space-y-1.5">
          <Label htmlFor="cueAnchorHabit" className="text-label font-medium">
            Right after
          </Label>
          {habits.length === 0 ? (
            <p className="text-muted-foreground text-label">
              You don&apos;t have another habit to stack this on yet. Name
              something you already do instead — it works just as well, and
              usually better.
            </p>
          ) : (
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger id="cueAnchorHabit" className="max-w-sm">
                <SelectValue placeholder="Pick a habit" />
              </SelectTrigger>
              <SelectContent>
                {habits.map((habit) => (
                  <SelectItem key={habit.id} value={habit.id}>
                    {habit.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-muted-foreground text-label">
            Both keep their own streaks. Putting this one on the calendar puts
            that one there too, immediately before it.
          </p>
          {taskIdError && (
            <p role="alert" className="text-destructive text-label">
              {taskIdError}
            </p>
          )}
        </div>
      )}

      {mode === "label" && (
        <div className="space-y-1.5">
          <Label htmlFor="cueLabelInput" className="text-label font-medium">
            Right after
          </Label>
          <Input
            id="cueLabelInput"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={120}
            placeholder="pouring my morning tea"
            className="max-w-sm"
          />
          <p className="text-muted-foreground text-label">
            This isn&apos;t tracked and never will be — no streak, no quota,
            nothing to keep up. It&apos;s only here to sit in front of the habit
            as the thing that starts it.
          </p>
          {labelError && (
            <p role="alert" className="text-destructive text-label">
              {labelError}
            </p>
          )}
        </div>
      )}

      {mode !== "none" && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="cueMinutesInput" className="text-label font-medium">
            Set aside
          </Label>
          <Input
            id="cueMinutesInput"
            type="number"
            min={1}
            max={240}
            value={minutes}
            onChange={(event) =>
              setMinutes(
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            className="h-9 w-20 text-center tabular-nums"
          />
          <span className="text-muted-foreground text-label">
            minutes for it on the calendar
            {mode === "habit" && " — unless that habit has its own estimate"}
          </span>
        </div>
      )}

      {recipe && (
        <p className="border-primary/40 bg-accent/40 rounded-lg border px-3 py-2 text-label">
          <span className="text-foreground">{recipe}</span>
        </p>
      )}
    </div>
  );
}
