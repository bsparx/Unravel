"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";

import { toggleStep } from "@/app/(app)/tasks/actions";
import { formatMinutes } from "@/lib/dates";
import { inOrder, type StepLike } from "@/lib/steps";
import { cn } from "@/lib/utils";

export type StepView = StepLike;

/**
 * The checklist, wherever it appears.
 *
 * Optimistic for the same reason the task checkbox is: the entire payoff of a
 * checklist is the instant the line goes quiet, and a round trip in between
 * spends that payoff on latency.
 *
 * The first *unticked* step is emphasised rather than the first step outright —
 * once you're three in, the useful thing to look at is four.
 */
export function StepList({
  steps,
  className,
}: {
  steps: StepView[];
  className?: string;
}) {
  const [, startTransition] = useTransition();
  const [shown, applyToggle] = useOptimistic(
    inOrder(steps),
    (current, change: { id: string; done: boolean }) =>
      current.map((step) =>
        step.id === change.id
          ? { ...step, completedAt: change.done ? new Date() : null }
          : step,
      ),
  );

  if (shown.length === 0) return null;

  const nextId = shown.find((step) => step.completedAt === null)?.id ?? null;

  const toggle = (step: StepView) => {
    const done = step.completedAt === null;
    startTransition(async () => {
      applyToggle({ id: step.id, done });
      const formData = new FormData();
      formData.set("stepId", step.id);
      formData.set("done", String(done));
      await toggleStep(formData);
    });
  };

  return (
    <ol className={cn("space-y-0.5", className)}>
      {shown.map((step, index) => {
        const done = step.completedAt !== null;
        const isNext = step.id === nextId;

        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => toggle(step)}
              aria-pressed={done}
              className={cn(
                "focus-visible:ring-ring group flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isNext ? "bg-accent/60 hover:bg-accent" : "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : isNext
                      ? "border-primary group-hover:bg-primary/15"
                      : "border-input group-hover:border-primary",
                )}
              >
                <Check
                  className={cn(
                    "size-2.5 transition-opacity",
                    done ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                  )}
                  strokeWidth={3}
                  aria-hidden
                />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-label",
                    done && "text-muted-foreground line-through",
                    isNext && "font-medium",
                  )}
                >
                  {step.title}
                </span>
                {isNext && index === 0 && (
                  <span className="text-primary block text-micro">
                    Start here. Nothing else needs deciding yet.
                  </span>
                )}
              </span>

              {step.estimatedSeconds ? (
                <span className="text-muted-foreground shrink-0 text-micro tabular-nums">
                  {formatMinutes(step.estimatedSeconds)}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
