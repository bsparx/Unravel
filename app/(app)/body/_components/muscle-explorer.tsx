"use client";

import { useMemo, useState } from "react";

import { bodyPartLabel } from "@/lib/exercise-labels";

import { BodyMap, type HoveredExercise } from "./body-map";
import { CatalogSection } from "./catalog-section";
import type { ExerciseDetail } from "./exercise-detail-dialog";

/**
 * Browse by body, not by dropdown: two figures on the left, the exercises
 * they point at on the right.
 *
 * The selected muscle is plain component state rather than a URL parameter —
 * it's a way of looking around the catalog, not a place you'd want to link
 * someone to or find in your history.
 */
export function MuscleExplorer({
  catalog,
  hovered,
  onHover,
}: {
  catalog: ExerciseDetail[];
  /** The exercise being pointed at, here or in the routine week above. */
  hovered: HoveredExercise;
  onHover: (hovered: HoveredExercise) => void;
}) {
  const [part, setPart] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const exercise of catalog) {
      for (const bodyPart of exercise.bodyParts) {
        tally[bodyPart] = (tally[bodyPart] ?? 0) + 1;
      }
    }
    return tally;
  }, [catalog]);

  return (
    <section className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <BodyMap
              side="front"
              selected={part}
              onSelect={setPart}
              counts={counts}
              hovered={hovered}
            />
            <BodyMap
              side="back"
              selected={part}
              onSelect={setPart}
              counts={counts}
              hovered={hovered}
            />
          </div>

          {/* One line, three jobs: name what's lit, or say what tapping does. */}
          <p className="text-muted-foreground mt-4 min-h-10 text-center text-label">
            {hovered ? (
              <>
                <span className="text-foreground">{hovered.name}</span>
                {" · "}
                {hovered.parts.map((p) => bodyPartLabel(p)).join(", ")}
              </>
            ) : part ? (
              "Tap it again to see everything."
            ) : (
              "Tap a muscle to find its exercises."
            )}
          </p>
        </div>
      </div>

      <div className="mt-8 lg:mt-0">
        <CatalogSection
          exercises={catalog}
          selectedPart={part}
          onClearPart={() => setPart(null)}
          onHover={onHover}
        />
      </div>
    </section>
  );
}
