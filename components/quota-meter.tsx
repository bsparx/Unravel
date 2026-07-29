"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Minus, Plus, Timer } from "lucide-react";

import { logHabitProgress } from "@/app/(app)/habits/actions";
import {
  formatQuota,
  minimumMarkerRatio,
  quotaRatio,
  remainingToMinimum,
  remainingToOptimal,
  tierFor,
  type Quota,
} from "@/lib/quota";
import { cn } from "@/lib/utils";

/**
 * A habit's progress against its two bars, for one day.
 *
 * The bar is drawn against the **optimal**, with the minimum as a notch partway
 * along, so the two are visible at once and the relationship between them is
 * obvious without reading anything. Filling to the notch changes colour — that
 * moment is "the streak is safe", and it is the single most important piece of
 * feedback this component gives.
 *
 * MINUTES habits are read-only here: their progress comes from the timer, and
 * a +1 button next to a number the clock owns would let the two disagree.
 */
export function QuotaMeter({
  taskId,
  dateISO,
  quota,
  progress,
  compact = false,
}: {
  taskId: string;
  dateISO: string;
  quota: Quota;
  progress: number;
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [shown, applyDelta] = useOptimistic(progress, (current, delta: number) =>
    Math.max(0, current + delta),
  );

  const tier = tierFor(shown, quota);
  const ratio = quotaRatio(shown, quota);
  const marker = minimumMarkerRatio(quota);
  const toMinimum = remainingToMinimum(shown, quota);
  const toOptimal = remainingToOptimal(shown, quota);

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

  return (
    <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-1.5")}>
      <div className="flex items-center gap-2">
        <div className="bg-muted relative h-2 min-w-0 flex-1 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-300",
              tier === "NONE" ? "bg-muted-foreground/40" : "bg-primary",
            )}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
          {marker !== null && (
            <span
              // The notch is the whole point of drawing against the optimal:
              // it shows how little "enough" actually is.
              className="bg-background absolute inset-y-0 w-0.5"
              style={{ left: `${Math.round(marker * 100)}%` }}
              aria-hidden
            />
          )}
        </div>

        <span
          className={cn(
            "shrink-0 text-label tabular-nums",
            tier === "NONE" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {shown}
          <span className="text-muted-foreground">
            /{quota.optimal ?? quota.minimum}
          </span>
        </span>

        {quota.unit === "COUNT" ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <StepButton
              label="One less"
              onClick={() => step(-1)}
              disabled={shown === 0}
            >
              <Minus className="size-3.5" aria-hidden />
            </StepButton>
            <StepButton label="One more" onClick={() => step(1)}>
              <Plus className="size-3.5" aria-hidden />
            </StepButton>
          </div>
        ) : (
          <span
            className="text-muted-foreground shrink-0"
            title="Counted from the timer"
          >
            <Timer className="size-3.5" aria-hidden />
          </span>
        )}
      </div>

      {!compact && (
        <p className="text-muted-foreground text-label">
          {toMinimum > 0 ? (
            <>
              <span className="text-foreground tabular-nums">
                {formatQuota(toMinimum, quota.unit)}
              </span>{" "}
              to keep the streak
            </>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                tier === "OPTIMAL" ? "text-primary" : "text-foreground",
              )}
            >
              <Check className="size-3" aria-hidden />
              {tier === "OPTIMAL"
                ? "A good day."
                : toOptimal !== null && toOptimal > 0
                  ? `Streak safe — ${formatQuota(toOptimal, quota.unit)} to a good day`
                  : "Streak safe."}
            </span>
          )}
        </p>
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
