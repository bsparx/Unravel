"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookmarkCheck,
  ChevronDown,
  Compass,
  Moon,
  ShieldAlert,
} from "lucide-react";

import { formatDuration } from "@/lib/dates";
import { hasEndingSummaryNotes } from "@/lib/ending-summary";
import type { EndingSummaryReport } from "@/lib/stats-summary";
import { cn } from "@/lib/utils";

/**
 * Yesterday's ending summary, rendered calmly on `/` (Today) and `/day`.
 * Keeps yesterday's lessons front-of-mind when starting and shaping today,
 * with a clean collapse toggle once you've taken it in.
 */
export function YesterdaySummaryCard({
  report,
  className,
  defaultExpanded = true,
}: {
  report: EndingSummaryReport;
  className?: string;
  defaultExpanded?: boolean;
}) {
  const hasNotes = hasEndingSummaryNotes(report);
  const [expanded, setExpanded] = useState(defaultExpanded && hasNotes);

  const statBits: string[] = [];
  if (
    typeof report.habitsDone === "number" &&
    typeof report.habitsTotal === "number" &&
    report.habitsTotal > 0
  ) {
    statBits.push(`${report.habitsDone}/${report.habitsTotal} habits`);
  }
  if (typeof report.productiveSeconds === "number" && report.productiveSeconds > 0) {
    statBits.push(formatDuration(report.productiveSeconds));
  }

  return (
    <section
      aria-label="Yesterday's ending summary"
      className={cn(
        "bg-card rounded-[22px] border border-[var(--card-edge)] shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={() => hasNotes && setExpanded((open) => !open)}
          disabled={!hasNotes}
          aria-expanded={hasNotes ? expanded : undefined}
          className={cn(
            "focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none",
            hasNotes ? "cursor-pointer" : "cursor-default",
          )}
        >
          <span
            aria-hidden
            className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-xl"
          >
            <Moon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold text-foreground">
              From yesterday&apos;s ending summary
            </p>
            <p className="text-muted-foreground truncate text-micro">
              {report.dateLabel}
              {statBits.length > 0 && (
                <>
                  {" · "}
                  <span className="font-mono tabular-nums">
                    {statBits.join(" · ")}
                  </span>
                </>
              )}
              {!hasNotes && " · Day reviewed"}
            </p>
          </div>
          {hasNotes && (
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform duration-200",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          )}
        </button>

        <Link
          href="/stats"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-lg px-2 py-1 text-micro font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Stats
        </Link>
      </div>

      {hasNotes && expanded && (
        <div className="border-border/50 space-y-3 border-t px-4 pt-3.5 pb-4 sm:px-5 sm:pb-5">
          {report.tryTomorrow?.trim() && (
            <div className="border-primary/30 bg-accent/35 rounded-xl border px-3.5 py-3">
              <p className="text-accent-foreground flex items-center gap-1.5 text-micro font-semibold">
                <Compass className="size-3.5 shrink-0" aria-hidden />
                Try today
              </p>
              <p className="text-foreground mt-1 whitespace-pre-line text-label leading-relaxed">
                {report.tryTomorrow}
              </p>
            </div>
          )}

          {report.keepDoing?.trim() && (
            <div className="border-border/60 bg-muted/35 rounded-xl border px-3.5 py-3">
              <p className="text-foreground/85 flex items-center gap-1.5 text-micro font-semibold">
                <BookmarkCheck className="text-flow size-3.5 shrink-0" aria-hidden />
                Remember &amp; focus on again
              </p>
              <p className="text-foreground/90 mt-1 whitespace-pre-line text-label leading-relaxed">
                {report.keepDoing}
              </p>
            </div>
          )}

          {report.avoid?.trim() && (
            <div className="border-border/60 bg-muted/35 rounded-xl border px-3.5 py-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-micro font-semibold">
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                Avoid today
              </p>
              <p className="text-foreground/90 mt-1 whitespace-pre-line text-label leading-relaxed">
                {report.avoid}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
