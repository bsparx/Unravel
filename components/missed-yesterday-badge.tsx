import { cn } from "@/lib/utils";

/**
 * The clay marker for a habit that was due yesterday and has nothing behind
 * it. Clay is the palette's "thing to notice" — the same token the adherence
 * grid uses for a miss — so no new colour exists for this.
 *
 * It names exactly one day on purpose: the whole signal is "don't let this
 * become two missed days in a row", and a counter of how many there have been
 * would be a tally of the wrong thing.
 */
export function MissedYesterdayBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-micro font-medium text-destructive",
        className,
      )}
    >
      <span className="bg-destructive size-1.5 rounded-full" aria-hidden />
      Missed yesterday
    </span>
  );
}
