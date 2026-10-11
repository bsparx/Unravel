"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";

import type { BeatState } from "@/lib/block-beats";
import { cn } from "@/lib/utils";

/**
 * One interval of an interval block, as a tappable square.
 *
 * Square for the same reason a block's task lines are: "any number of these",
 * not "pick one". Done fills with the primary, the live interval wears a ring,
 * and a past one with nothing in it just goes quiet — there is no red here on
 * purpose.
 *
 * The visible mark stays small; `hitClassName` is where callers buy the 44px
 * target, so the grid can keep it tight and the agenda can make it roomy.
 */
export function BeatSquare({
  state,
  label,
  onToggle,
  className,
  markClassName,
  style,
}: {
  state: BeatState;
  /** Spoken name, e.g. "Interval 3, 10:30 to 10:45". */
  label: string;
  onToggle: () => void;
  className?: string;
  markClassName?: string;
  style?: CSSProperties;
}) {
  const done = state === "done";

  return (
    <button
      type="button"
      aria-label={`${label}${done ? ", done" : state === "current" ? ", now" : ""}`}
      aria-pressed={done}
      title={done ? "Untick this interval" : "Did one thing in this interval"}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "group/beat focus-visible:ring-ring relative grid shrink-0 place-items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-3 place-items-center rounded-[3px] border transition-colors",
          done && "border-primary bg-primary text-primary-foreground animate-pop",
          state === "current" &&
            "border-primary ring-primary/40 bg-background/60 ring-2",
          state === "upcoming" && "border-current/45 group-hover/beat:border-current",
          state === "past" && "border-current/20 group-hover/beat:border-current/60",
          markClassName,
        )}
      >
        <Check
          className={cn(
            "size-2 transition-opacity",
            done ? "opacity-100" : "opacity-0 group-hover/beat:opacity-45",
          )}
          strokeWidth={3}
          aria-hidden
        />
      </span>
    </button>
  );
}
