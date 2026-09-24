"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Clock, CornerDownRight, Minus, Plus } from "lucide-react";

import { logHabitProgress, toggleHabitForDate } from "@/app/(app)/habits/actions";
import { TaskCheckbox } from "@/components/task-checkbox";
import {
  claimDone,
  formatLogged,
  type HabitBar,
} from "@/lib/habit-bar";
import { cn } from "@/lib/utils";

/**
 * The day's ask, before and after it's done. Presentational — no buttons, so
 * it can sit inside the row's timer link where the next step used to sit.
 *
 * Before, it leads with the minimal task and says out loud that this is the
 * whole requirement: the line *is* the call to action. After, it settles into
 * the past tense with the optional log beside it ("Did the warmup · 25m
 * extra") and the identity vote lands at the end — the reinforcement loop,
 * said once and without ceremony. Nothing animates here beyond the checkbox's
 * pop: a met day settles rather than celebrates, the rule /water settled on.
 */
export function HabitDayLine({
  bar,
  progress,
  done,
  identities,
  className,
}: {
  bar: HabitBar;
  /** Today's optional log, in the habit's own unit. */
  progress: number;
  /** The day is DONE — accepted, note and all. */
  done: boolean;
  /** Names of the identities this habit is a vote for. */
  identities?: string[];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-0.5 flex flex-wrap items-baseline gap-x-2 text-label",
        className,
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5",
          done ? "text-muted-foreground" : "text-primary",
        )}
      >
        {done ? (
          <Check className="size-3 shrink-0" aria-hidden />
        ) : (
          <CornerDownRight className="size-3 shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {done ? claimDone(bar.minimalTask) : bar.minimalTask}
        </span>
        {!done && (
          <span className="text-muted-foreground shrink-0">
            — that&apos;s the day
          </span>
        )}
      </span>

      {progress > 0 && (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          · {formatLogged(progress, bar.unit)}
          {done ? " extra" : " logged"}
        </span>
      )}

      {done && identities && identities.length > 0 && (
        <span className="text-muted-foreground shrink-0 text-micro">
          That&apos;s a vote for {identities.join(" · ")}.
        </span>
      )}
    </span>
  );
}

/**
 * A habit's whole day on the habits page: the claim, the ask, the optional log.
 *
 * The checkbox is the win — it claims the minimal task and books **no
 * number**. The log beside it is un-metered: COUNT gets ±1 taps and MINUTES
 * fills from the timer (or a manual log, where the caller provides one).
 * Neither is ever required, and there is no second bar to fall short of.
 */
export function HabitDayControl({
  taskId,
  dateISO,
  bar,
  progress,
  done,
  label,
  identities,
  onLogTime,
}: {
  taskId: string;
  dateISO: string;
  bar: HabitBar;
  progress: number;
  done: boolean;
  /** Plain-text habit name, for the checkbox's accessible name. */
  label: string;
  identities?: string[];
  /**
   * Open a manual time log. Only offered for MINUTES habits, and only where a
   * dialog lives (the day list). Elsewhere the timer is the door — the card's
   * title already opens it.
   */
  onLogTime?: () => void;
}) {
  const [, startTransition] = useTransition();
  const [shown, applyDelta] = useOptimistic(progress, (current, delta: number) =>
    Math.max(0, current + delta),
  );

  const step = (delta: number) => {
    startTransition(async () => {
      applyDelta(delta);
      const formData = new FormData();
      formData.set("taskId", taskId);
      formData.set("date", dateISO);
      formData.set("increment", String(delta));
      await logHabitProgress(formData);
    });
  };

  const toggle = (next: boolean) => {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("date", dateISO);
    formData.set("done", String(next));
    return toggleHabitForDate(formData);
  };

  return (
    <div className="flex items-start gap-2">
      <TaskCheckbox done={done} label={label} onToggle={toggle} />

      <div className="min-w-0 flex-1">
        <HabitDayLine
          bar={bar}
          progress={shown}
          done={done}
          identities={identities}
        />
      </div>

      {bar.unit === "COUNT" ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <StepButton label="One less" onClick={() => step(-1)} disabled={shown === 0}>
            <Minus className="size-3.5" aria-hidden />
          </StepButton>
          <StepButton label="One more" onClick={() => step(1)}>
            <Plus className="size-3.5" aria-hidden />
          </StepButton>
        </div>
      ) : onLogTime ? (
        <button
          type="button"
          onClick={onLogTime}
          className="text-muted-foreground hover:text-foreground hover:border-primary/50 border-border focus-visible:ring-ring shrink-0 rounded-full border p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Log time for ${label}`}
          title="Log time"
        >
          <Clock className="size-3.5" aria-hidden />
        </button>
      ) : (
        <span
          className="text-muted-foreground shrink-0"
          title="Counted from the timer"
        >
          <Clock className="size-3.5" aria-hidden />
        </span>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 focus-visible:ring-ring rounded-full border p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
