import Link from "next/link";
import { CornerDownRight, Link2 } from "lucide-react";

import { describeCue } from "@/lib/habit-cue";
import type { CueSummary } from "@/lib/tasks";

/**
 * "After pouring my morning tea" — the trigger, above the habit's name.
 *
 * Rendered small and quiet but never hidden. The anchor is the part of a habit
 * stack that does the work, and the sentence is what makes the next action
 * obvious; a stack you have to go looking for is just a note in a database.
 *
 * A habit anchor links through to its own card, because "what triggers the
 * thing that triggers this" is the natural next question once a chain exists.
 * A label anchor is plain text — there is nothing to visit, on purpose.
 */
export function HabitCueLine({ cue }: { cue: CueSummary }) {
  const description = describeCue(cue.anchorTitle);
  if (!description) return null;

  return (
    <p className="text-muted-foreground mb-0.5 flex items-center gap-1 truncate text-micro normal-case tracking-normal">
      <CornerDownRight className="size-3 shrink-0" aria-hidden />
      {cue.anchorTaskId ? (
        <>
          After{" "}
          <Link
            href={`/habits/${cue.anchorTaskId}`}
            className="hover:text-primary focus-visible:ring-ring truncate rounded underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            {cue.anchorTitle}
          </Link>
        </>
      ) : (
        <span className="truncate">{description}</span>
      )}
    </p>
  );
}

/**
 * The whole stack, earliest first: "tea → Meditation → Journal".
 *
 * Reference material, so it lives behind the card's disclosure with the schedule
 * and the streak. Only rendered when there is more than one step in front of
 * this habit — for a single anchor it would just repeat the line above.
 */
export function HabitStackTrail({ steps }: { steps: string[] }) {
  if (steps.length < 3) return null;

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-label">
      <Link2 className="size-3 shrink-0" aria-hidden />
      {steps.map((step, index) => (
        <span key={`${step}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden>→</span>}
          <span
            className={index === steps.length - 1 ? "text-foreground" : undefined}
          >
            {step}
          </span>
        </span>
      ))}
    </p>
  );
}
