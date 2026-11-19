"use client";

import { useEffect, useRef, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** What a tab's dot says, done or not yet. */
export type TabDot = { colour: string; done: string; not: string; srDone: string; srNot: string };

/**
 * The open tab, kept in the URL so a reload lands where you were. Native
 * history keeps it a URL change, not a server round trip. The first tab is
 * the bare URL.
 */
export function useUrlTab<T extends string>(initial: T, tabs: readonly T[]) {
  const [tab, setTab] = useState<T>(initial);
  const switchTab = (next: T) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === tabs[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };
  return [tab, switchTab] as const;
}

/**
 * A section's practices as one pill of tabs, each with a dot for whether
 * today is done. Shared by Mind and Heart so the two read as one family. On a
 * phone the pill scrolls rather than wraps, and keeps the open tab in view.
 */
export function SectionTabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
  labels,
  dots,
  doneToday,
}: {
  /** "Mind sections". */
  label: string;
  /** Panels are `${idPrefix}-${tab}`. */
  idPrefix: string;
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  labels: Record<T, string>;
  dots: Record<T, TabDot>;
  doneToday: Record<T, boolean>;
}) {
  const selectedTab = useRef<HTMLButtonElement>(null);

  // A link to a later tab otherwise lands with it hidden off the right edge.
  useEffect(() => {
    selectedTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div className="relative -mx-5 max-w-[calc(100%+2.5rem)] overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0">
      <div role="tablist" aria-label={label} className="border-border bg-muted/40 inline-flex rounded-full border p-1">
        {tabs.map((tab) => {
          const selected = value === tab;
          const done = doneToday[tab];
          const dot = dots[tab];
          return (
            <button
              key={tab}
              ref={selected ? selectedTab : undefined}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-${tab}`}
              onClick={() => onChange(tab)}
              className={cn(
                "focus-visible:ring-ring inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-label font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[tab]}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("size-1.5 rounded-full", done ? dot.colour : "border-muted-foreground/50 border")}>
                    <span className="sr-only">{done ? dot.srDone : dot.srNot}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{done ? dot.done : dot.not}</TooltipContent>
              </Tooltip>
            </button>
          );
        })}
      </div>
    </div>
  );
}
