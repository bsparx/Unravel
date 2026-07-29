"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CornerDownRight,
  Pencil,
  Play,
  Repeat,
  Timer,
} from "lucide-react";

import { StepList } from "@/components/step-list";
import { TaskCheckbox } from "@/components/task-checkbox";
import { formatDuration, formatMinutes } from "@/lib/dates";
import { nextStep, stepProgress } from "@/lib/steps";
import type { TodayItem } from "@/lib/tasks";
import { buildTimerHref } from "@/lib/timer-url";
import { cn } from "@/lib/utils";

/**
 * A row in any list. The whole row is a link to the timer, pre-configured with
 * this task's estimate — that's the connective tissue of the app. The checkbox
 * sits outside the link so ticking off never navigates.
 *
 * When a task has steps, the row leads with the next one rather than the task
 * title alone. "Do the taxes" has no handle; "find last year's return" does,
 * and it's the handle that decides whether the row gets clicked.
 */
export function TaskRow({
  item,
  onToggle,
  showDueLabel,
}: {
  item: TodayItem;
  onToggle: (next: boolean) => Promise<void>;
  showDueLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const href = buildTimerHref({
    id: item.id,
    estimatedSeconds: item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
  });

  const steps = item.steps ?? [];
  const progress = stepProgress(steps);
  const upNext = nextStep(steps);
  const editHref = item.type === "HABIT" ? `/habits/${item.id}` : `/tasks/${item.id}`;

  return (
    <li className="group border-border/60 border-b last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        <TaskCheckbox
          done={item.done}
          label={item.title}
          priority={item.priority}
          onToggle={onToggle}
        />

        <Link
          href={href}
          className="focus-visible:ring-ring -my-1 min-w-0 flex-1 rounded-md px-1 py-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "truncate text-body",
                item.done && "text-muted-foreground line-through",
              )}
            >
              {item.title}
            </span>
          </span>

          {upNext && !item.done && (
            // The row's real call to action. Kept inside the timer link so
            // clicking the step you're about to do starts the clock on it.
            <span className="text-primary mt-0.5 flex items-center gap-1.5 text-label">
              <CornerDownRight className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{upNext.title}</span>
              {upNext.estimatedSeconds ? (
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatMinutes(upNext.estimatedSeconds)}
                </span>
              ) : null}
            </span>
          )}

          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
            {item.type === "HABIT" && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" aria-hidden />
                Habit
              </span>
            )}

            {item.project && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full bg-current opacity-60"
                  aria-hidden
                />
                {item.project.name}
              </span>
            )}

            {showDueLabel && (
              <span
                className={cn(
                  item.daysUntilDue !== null &&
                    item.daysUntilDue < 0 &&
                    "text-destructive",
                )}
              >
                {showDueLabel}
              </span>
            )}

            {item.estimatedSeconds ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Timer className="size-3" aria-hidden />
                {formatMinutes(item.estimatedSeconds)}
              </span>
            ) : null}

            {item.loggedSeconds > 0 && (
              <span className="text-running tabular-nums">
                {formatDuration(item.loggedSeconds)} logged
              </span>
            )}
          </span>
        </Link>

        {progress.total > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} the steps for ${item.title}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-micro tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {progress.done}/{progress.total}
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        )}

        {/* Row actions, revealed on hover. Edit lives here rather than on the
            title, because the title's job is starting the timer — the single
            most common thing anyone does with a row. */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Link
            href={editHref}
            aria-label={`Edit ${item.title}`}
            className="text-muted-foreground hover:text-foreground hover:border-primary/40 border-border focus-visible:ring-ring rounded-full border p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Pencil className="size-3.5" aria-hidden />
          </Link>
          <Link
            href={href}
            aria-label={`Start a timer for ${item.title}`}
            className="text-muted-foreground hover:text-primary hover:border-primary/40 border-border focus-visible:ring-ring rounded-full border p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Play className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {progress.total > 0 && (
        <>
          {/* A hairline, not a bar. It's ambient progress — you should be able
              to read it without looking at it, and never mistake it for the
              timer's own arc. */}
          <div className="bg-muted mb-1.5 h-0.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary/70 h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>

          {expanded && (
            <div className="animate-in fade-in slide-in-from-top-1 pb-2 pl-8 duration-200 motion-reduce:animate-none">
              <StepList steps={steps} />
            </div>
          )}
        </>
      )}
    </li>
  );
}
