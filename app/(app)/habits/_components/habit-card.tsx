"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A habit, collapsed to the two things you can act on: its name, and today's
 * day. Everything else — the schedule, the streak, eight weeks of adherence
 * — is reference material, and reference material you haven't asked for is
 * just a tax on scanning the list.
 *
 * The slots are server-rendered and passed through. This component only owns
 * the disclosure so the daily promise stays visible while history stays quiet.
 */
export function HabitCard({
  id,
  title,
  name,
  cue,
  actions,
  day,
  meta,
  adherence,
  children,
}: {
  id: string;
  /** The habit name, rendered in the reading face. */
  title: ReactNode;
  /**
   * The trigger this habit is stacked on. Sits above the title and is NOT behind
   * the disclosure, unlike everything else here: a cue you have to expand a card
   * to read has stopped doing the one job it has.
   */
  cue?: ReactNode;
  /** The plain-text title, for the toggle's accessible name. */
  name: string;
  /** Explicit Start and More controls, available on touch. */
  actions: ReactNode;
  /** Today's day control — always visible, it's the actionable bit. */
  day: ReactNode;
  /** Schedule, quota description, estimate, streak. */
  meta: ReactNode;
  adherence: number;
  /** The eight-week grid. */
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <li id={id} className="border-border bg-card scroll-mt-8 rounded-[1.25rem] border p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          {cue}
          {title}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {actions}
        </div>
      </div>

      <div className="mt-3">{day}</div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? "Hide" : "Show"} history and schedule for ${name}`}
        className="text-muted-foreground mt-3 min-h-11 gap-2"
      >
        History and schedule
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </Button>

      <div id={detailsId} hidden={!expanded}>
        {expanded && (
          <div className="border-border mt-2 space-y-4 border-t pt-4">
            {meta}

            <div className="space-y-2">
              <p className="text-muted-foreground text-label">
                <span className="tabular-nums">{adherence}%</span> over eight
                weeks
              </p>
              <div className="overflow-x-auto">{children}</div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
