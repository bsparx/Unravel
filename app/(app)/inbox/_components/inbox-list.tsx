"use client";

import { useOptimistic, useTransition } from "react";
import { ArrowRight, Inbox, X } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/dates";
import type { RawCapture } from "@/lib/captures";

import { dismissCapture, promoteCapture } from "../actions";

/**
 * Triage.
 *
 * Optimistic on purpose: emptying an inbox only feels like progress if rows
 * leave the moment you decide, not a round trip later. The reward for
 * triaging has to be immediate or you stop doing it.
 */
export function InboxList({
  captures,
  timezone,
}: {
  captures: RawCapture[];
  timezone: string;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, removeOptimistic] = useOptimistic(
    captures,
    (current, removedId: string) =>
      current.filter((capture) => capture.id !== removedId),
  );

  const act = (
    id: string,
    action: (formData: FormData) => Promise<void>,
  ) => {
    startTransition(async () => {
      removeOptimistic(id);
      const formData = new FormData();
      formData.set("captureId", id);
      await action(formData);
    });
  };

  if (optimistic.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing waiting"
        description="Press c from anywhere to write something down. It lands here and you sort it out whenever you feel like it — not now."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {optimistic.map((capture) => (
        <li
          key={capture.id}
          className="group border-border bg-card flex items-start gap-3 rounded-lg border p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-body whitespace-pre-wrap break-words">
              {capture.body}
            </p>
            <p className="text-muted-foreground mt-1 text-micro">
              {formatTimestamp(capture.createdAt, timezone)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act(capture.id, promoteCapture)}
              aria-label={`Make a task from "${capture.body.slice(0, 40)}"`}
            >
              <ArrowRight className="size-4" aria-hidden />
              Make it a task
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => act(capture.id, dismissCapture)}
              aria-label={`Let go of "${capture.body.slice(0, 40)}"`}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
