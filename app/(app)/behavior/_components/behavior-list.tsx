"use client";

import { Brain } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { formatTimestamp } from "@/lib/dates";
import type { RawCapture } from "@/lib/captures";

/**
 * The log. No triage, no promotion, no dismiss — a behavior entry is a record,
 * not a queue. You write it to see it; the seeing is the whole point.
 */
export function BehaviorList({
  captures,
  timezone,
}: {
  captures: RawCapture[];
  timezone: string;
}) {
  if (captures.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="Nothing logged yet"
        description="Press c from anywhere and note the urge and what set it off. It lands here with a timestamp — no sorting required."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {captures.map((capture) => (
        <li
          key={capture.id}
          className="border-border bg-card flex items-start gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-body whitespace-pre-wrap break-words">
              {capture.body}
            </p>
            <p className="text-muted-foreground mt-1 text-micro">
              {formatTimestamp(capture.createdAt, timezone)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
