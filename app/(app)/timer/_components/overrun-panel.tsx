"use client";

import { ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/** What one press of "more" buys. Matches the default short break. */
export const EXTENSION_SECONDS = 5 * 60;

/**
 * The controls for a break that is past its time.
 *
 * Two buttons, and deliberately only two. This screen catches someone at the
 * exact moment their attention is somewhere else, and a menu is a decision —
 * the thing they are least able to make right now. The brief's rule is that a
 * screen asking for more than one decision is wrong, and this one asks the
 * smallest version of it: back, or more.
 *
 * The distinction between the two is load-bearing rather than cosmetic. "5 more
 * minutes" raises the interval's own target, so those minutes are logged as
 * time you claimed; walking away logs them as time that got away. On a clock
 * they are identical, and telling them apart is the only reason the number on
 * /stats means anything.
 */
export function OverrunPanel({
  returnLabel,
  onBack,
  onExtend,
}: {
  /** The resumption cue — what you were in the middle of. */
  returnLabel: string | null;
  onBack: () => void;
  onExtend: (seconds: number) => void;
}) {
  return (
    <div className="animate-rise mt-6 flex w-full max-w-md flex-col items-center gap-3">
      {returnLabel && (
        <p className="text-center text-label text-balance">
          <span className="text-muted-foreground">You&apos;re on </span>
          <span className="font-medium text-foreground">{returnLabel}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 p-1.5">
        <Button
          size="lg"
          className="bg-destructive text-white hover:bg-destructive/90 min-w-36 rounded-xl px-6 shadow-none transition-colors"
          onClick={onBack}
        >
          <ArrowRight className="mr-1.5 size-4" aria-hidden />
          Back to it
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="rounded-xl border-destructive/30 bg-background/60 px-5 text-foreground transition-colors hover:border-destructive hover:bg-destructive/10"
          onClick={() => onExtend(EXTENSION_SECONDS)}
        >
          <Plus className="mr-1.5 size-4" aria-hidden />5 more min
        </Button>
      </div>
    </div>
  );
}
