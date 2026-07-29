"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A habit, collapsed to the two things you can act on: its name, and today's
 * quota. Everything else — the schedule, the streak, eight weeks of adherence
 * — is reference material, and reference material you haven't asked for is
 * just a tax on scanning the list.
 *
 * The slots are all server-rendered and passed straight through; this owns the
 * whole card only because the toggle sits in the header and what it reveals
 * sits at the bottom, which a wrapper around the tail alone can't express.
 */
export function HabitCard({
  title,
  name,
  actions,
  quota,
  meta,
  adherence,
  children,
}: {
  /** The linked habit title. */
  title: ReactNode;
  /** The plain-text title, for the toggle's accessible name. */
  name: string;
  /** Edit and archive controls, pinned to the header. */
  actions: ReactNode;
  /** Today's quota meter — always visible, it's the actionable bit. */
  quota: ReactNode;
  /** Schedule, quota description, estimate, streak. */
  meta: ReactNode;
  adherence: number;
  /** The eight-week grid. */
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="border-border bg-card rounded-lg border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{title}</div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${name}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {actions}
        </div>
      </div>

      <div className="mt-2">{quota}</div>

      {expanded && (
        <div className="mt-3 space-y-3">
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
    </li>
  );
}
