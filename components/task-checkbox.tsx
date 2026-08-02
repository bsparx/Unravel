"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The one control for ticking anything off, shared by every list.
 *
 * Optimistic on purpose: the click has to feel instant, because the whole
 * reward of a list like this is the moment the thing goes away.
 */
export function TaskCheckbox({
  done,
  label,
  onToggle,
  priority = "P4",
  gatedTick = false,
  className,
}: {
  done: boolean;
  label: string;
  onToggle: (next: boolean) => void | Promise<void>;
  priority?: "P1" | "P2" | "P3" | "P4";
  /** Ticking done will be intercepted before any optimistic state — the
      caller shows a dialog instead. The transition must not block on it. */
  gatedTick?: boolean;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);

  const ringByPriority = {
    P1: "border-destructive",
    P2: "border-running",
    P3: "border-primary",
    P4: "border-input",
  }[priority];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticDone}
      aria-label={optimisticDone ? `Undo ${label}` : `Complete ${label}`}
      disabled={isPending}
      onClick={() => {
        const next = !optimisticDone;
        // A gated tick is handled by the caller (a dialog opens) — don't wrap
        // it in the transition or optimistically check it, otherwise the
        // transition hangs waiting on the dialog and the box freezes.
        if (next && gatedTick) {
          onToggle(next);
          return;
        }
        startTransition(async () => {
          setOptimisticDone(next);
          await onToggle(next);
        });
      }}
      className={cn(
        "focus-visible:ring-ring group grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        // The pop is keyed off the optimistic value, so it fires on the click
        // rather than on the server's answer. Celebrating a round trip late is
        // worse than not celebrating.
        optimisticDone
          ? "border-primary bg-primary animate-pop"
          : cn(ringByPriority, "hover:border-primary"),
        className,
      )}
    >
      <Check
        className={cn(
          "size-3 transition-opacity motion-reduce:transition-none",
          optimisticDone
            ? "text-primary-foreground opacity-100"
            : "text-muted-foreground opacity-0 group-hover:opacity-40",
        )}
        strokeWidth={3}
        aria-hidden
      />
    </button>
  );
}
