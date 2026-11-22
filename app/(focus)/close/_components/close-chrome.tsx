"use client";

import Link from "next/link";
import { InfoTip } from "@/components/info-tip";
import { closeStepHref, closeSteps, type CloseStep } from "@/lib/close-ritual";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<CloseStep, string> = {
  summary: "Summary",
  "one-thing": "Tomorrow",
  worry: "Clear mind",
  handoff: "Rest",
};

/**
 * Quiet step rail at the top of `/close`. Lets you orient at a glance and
 * step back without heavy wizard chrome.
 */
export function CloseStepNav({
  current,
  includeSummary,
  dateLabel,
}: {
  current: CloseStep;
  includeSummary: boolean;
  dateLabel?: string;
}) {
  const steps = closeSteps(includeSummary);
  const currentIndex = steps.indexOf(current);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-micro text-muted-foreground flex items-center gap-1 font-medium tracking-wider uppercase">
        <span>Close the day</span>
        <InfoTip term={current === "summary" ? "endingSummary" : "close"} className="ml-0.5" />
        {dateLabel && (
          <>
            <span aria-hidden className="mx-1 opacity-45">·</span>
            <span className="font-mono normal-case tracking-normal">
              {dateLabel}
            </span>
          </>
        )}
      </p>

      <nav aria-label="Close the day steps" className="flex items-center gap-1">
        {steps.map((step, index) => {
          const isCurrent = step === current;
          const isPast = index < currentIndex;
          return (
            <Link
              key={step}
              href={closeStepHref(step)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-micro transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isCurrent
                  ? "bg-accent text-accent-foreground font-medium"
                  : isPast
                    ? "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
                    : "text-muted-foreground/80 hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  isCurrent
                    ? "bg-primary"
                    : isPast
                      ? "bg-flow"
                      : "bg-border",
                )}
              />
              <span>{STEP_LABELS[step]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
