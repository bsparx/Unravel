"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/dates";
import { EQUIPMENT_LABELS } from "@/lib/exercise-labels";
import { summarizeWeek } from "@/lib/exercise-routine";

import {
  BuildRoutineDialog,
  type BuildCatalogExercise,
} from "./build-routine-dialog";
import { CatalogSection } from "./catalog-section";
import {
  RoutineWeek,
  type RoutineSlot,
} from "./routine-week";

/**
 * The exercises surface, in one place: the routine week (or the invitation to
 * build one) and the catalog beneath it. A plain client shell — all the data
 * arrives ready-shaped from the server page.
 */
export function ExercisesView({
  routineId,
  daysOfWeek,
  slots,
  catalog,
}: {
  routineId: string | null;
  daysOfWeek: number[];
  slots: RoutineSlot[];
  catalog: BuildCatalogExercise[];
}) {
  const [building, setBuilding] = useState(false);

  const hasRoutine = routineId !== null;
  const week = summarizeWeek(
    slots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      position: slot.position,
      exerciseId: slot.exercise.id,
    })),
    catalog,
  );

  const daysLabel = daysOfWeek
    .map((day) => WEEKDAYS.find((d) => d.value === day)?.short ?? "")
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-display">Exercises</h1>
        <p className="text-muted-foreground max-w-prose text-body">
          A corrective week for the two postural patterns a desk builds:
          anterior pelvic tilt and rounded shoulders. Yoga and light dumbbells,
          three exercises a day, never more.
        </p>
        {hasRoutine && (
          <p className="text-label text-muted-foreground">
            {daysOfWeek.length} days a week · {daysLabel} ·{" "}
            {EQUIPMENT_LABELS.YOGA.toLowerCase()} {week.yoga} /{" "}
            {EQUIPMENT_LABELS.DUMBBELL.toLowerCase()} {week.dumbbell}
          </p>
        )}
      </header>

      {hasRoutine ? (
        <RoutineWeek
          routineId={routineId!}
          daysOfWeek={daysOfWeek}
          slots={slots}
          catalog={catalog}
        />
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No routine yet"
          description="Build a weekly plan: pick 3, 4 or 5 days, name the exact days, and get a balanced set of exercises for each one — at most three a day."
          action={
            <Button type="button" onClick={() => setBuilding(true)}>
              <Plus className="size-4" aria-hidden />
              Build your routine
            </Button>
          }
        />
      )}

      {building && (
        <BuildRoutineDialog catalog={catalog} onClose={() => setBuilding(false)} />
      )}

      <CatalogSection exercises={catalog} />
      </div>
    </div>
  );
}
