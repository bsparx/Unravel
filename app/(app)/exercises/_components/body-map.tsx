"use client";

import { useId } from "react";

import { bodyPartLabel } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import {
  BACK_REGIONS,
  BODY_BASE,
  BODY_DETAIL,
  FRONT_REGIONS,
  MAPPED_PARTS,
  VIEW_BOX,
  type MuscleRegion,
} from "./body-map-paths";

/** The exercise under the cursor: what it targets, and what it's called. */
export type HoveredExercise = { name: string; parts: string[] } | null;

/** An exercise that names this works the whole body, not one place on it. */
const FULL_BODY = "FULL_BODY";

/**
 * One anatomical figure — front or back — where every muscle group is a
 * control. Hovering lifts a muscle, clicking filters the catalog to it, and
 * clicking the selected one again clears the filter.
 *
 * The figure reads in both directions: pointing at a muscle finds exercises,
 * and pointing at an exercise anywhere on the page lights the muscles it
 * works. The two states are drawn differently on purpose — a filter you chose
 * is solid, a passing highlight is a wash — so a lit figure never looks like
 * a filter you don't remember setting.
 *
 * The two figures are peers rather than a pair of views onto one thing: a
 * muscle lives on exactly one side (except the deltoids, which the catalog
 * treats as a single `SHOULDERS` code and both figures therefore offer).
 */
export function BodyMap({
  side,
  selected,
  onSelect,
  counts,
  hovered,
}: {
  side: "front" | "back";
  /** The currently filtered `BodyPart` code, or null. */
  selected: string | null;
  onSelect: (part: string | null) => void;
  /** How many catalog exercises target each part. */
  counts: Record<string, number>;
  /** The exercise being pointed at elsewhere on the page. */
  hovered: HoveredExercise;
}) {
  const titleId = useId();
  const front = side === "front";
  const regions = front ? FRONT_REGIONS : BACK_REGIONS;

  const lit = new Set(
    hovered === null
      ? []
      : hovered.parts.includes(FULL_BODY)
        ? MAPPED_PARTS
        : hovered.parts,
  );

  // Left and right halves of one muscle move together, so they are grouped
  // by part rather than drawn as independent controls.
  const byPart = new Map<string, MuscleRegion[]>();
  for (const region of regions) {
    byPart.set(region.part, [...(byPart.get(region.part) ?? []), region]);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={VIEW_BOX}
        role="group"
        aria-labelledby={titleId}
        className="h-auto w-full max-w-[15rem] overflow-visible"
      >
        <title id={titleId}>{front ? "Front of the body" : "Back of the body"}</title>

        {/* Seen from behind, the person's left is on your right. */}
        <g transform={front ? undefined : "translate(200,0) scale(-1,1)"}>
        {/* The body, then the untargetable limbs over it, then the muscles.
            In dark mode every surface token sits within a few percent of the
            others, so the outlines carry the drawing, not the fills — hence
            a stroke keyed to muted-foreground rather than to border. */}
        <g className="fill-secondary pointer-events-none">
          {BODY_BASE.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>

        <g className="fill-secondary stroke-muted-foreground/25 pointer-events-none [stroke-width:1]">
          {BODY_DETAIL.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>

        {[...byPart.entries()].map(([part, paths]) => {
          const count = counts[part] ?? 0;
          const isSelected = selected === part;
          const isLit = lit.has(part);
          const label = bodyPartLabel(part);

          if (count === 0) {
            return (
              <g
                key={part}
                className="fill-muted stroke-muted-foreground/15 pointer-events-none [stroke-width:1]"
              >
                {paths.map((region, index) => (
                  <path key={index} d={region.d} />
                ))}
              </g>
            );
          }

          return (
            <g
              key={part}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${label} — ${count} ${count === 1 ? "exercise" : "exercises"}`}
              onClick={() => onSelect(isSelected ? null : part)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(isSelected ? null : part);
              }}
              className={cn(
                "cursor-pointer outline-none transition-[fill,stroke] duration-200",
                "[stroke-width:1.25]",
                isSelected
                  ? "fill-primary stroke-primary"
                  : isLit
                    ? "fill-primary/45 stroke-primary"
                    : "fill-muted stroke-muted-foreground/40 hover:fill-accent hover:stroke-primary/60 focus-visible:fill-accent",
                "focus-visible:stroke-ring focus-visible:[stroke-width:2.5]",
              )}
            >
              <title>{`${label} — ${count} ${count === 1 ? "exercise" : "exercises"}`}</title>
              {paths.map((region, index) => (
                <path key={index} d={region.d} />
              ))}
            </g>
          );
        })}
        </g>
      </svg>

      <span className="text-micro text-muted-foreground tracking-wider uppercase">
        {front ? "Front" : "Back"}
      </span>
    </div>
  );
}
