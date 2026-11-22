"use client";

import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FastingView } from "@/lib/body-data";
import type { BodyTab } from "@/lib/body-tabs";
import { cn } from "@/lib/utils";

import type { ExercisesData } from "../page";
import { ExercisesView } from "./exercises-view";
import { FastingPanel } from "./fasting-panel";

const LABELS: Record<BodyTab, string> = {
  exercises: "Exercises",
  fasting: "Fasting",
};

/**
 * /body: exercises and fasting behind one switch each. The tab lives in the
 * URL so a reload lands where you were; native history keeps it a URL
 * change, not a server round trip.
 */
export function BodyBoard({
  initialTab,
  tabs,
  exercises,
  fasting,
}: {
  initialTab: BodyTab;
  tabs: BodyTab[];
  exercises: ExercisesData | null;
  fasting: FastingView | null;
}) {
  const [tab, setTab] = useState<BodyTab>(initialTab);

  const switchTab = (next: BodyTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === tabs[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-10">
          <div role="tablist" aria-label="Body sections" className="border-border bg-muted/40 inline-flex rounded-full border p-1">
            {tabs.map((value) => {
              const selected = tab === value;
              const fastingRunning = value === "fasting" && Boolean(fasting?.open);
              const doneToday =
                value === "exercises"
                  ? Boolean(exercises?.tending.today)
                  : Boolean(fasting?.tending.today);
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`body-${value}`}
                  onClick={() => switchTab(value)}
                  className={cn(
                    "focus-visible:ring-ring inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-label font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {LABELS[value]}
                  {fastingRunning ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="fast-pulse size-1.5 rounded-full bg-[var(--fast-ring)]">
                          <span className="sr-only">(a fast is running)</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">A fast is running</TooltipContent>
                    </Tooltip>
                  ) : doneToday ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            value === "exercises"
                              ? "bg-[var(--grove-dot)]"
                              : "bg-[var(--orchard-dot)]",
                          )}
                        >
                          <span className="sr-only">(done today)</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {value === "exercises"
                          ? "Exercise checked off today"
                          : "Fasted today"}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <section id={`body-${tab}`} role={tabs.length > 1 ? "tabpanel" : undefined} aria-label={LABELS[tab]}>
        {tab === "exercises" && exercises && <ExercisesView {...exercises} />}
        {tab === "fasting" && fasting && <FastingPanel view={fasting} />}
      </section>
    </div>
  );
}
