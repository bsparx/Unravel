"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/dates";
import {
  EQUIPMENT_LABELS,
  ROUTINE_EQUIPMENT_LABELS,
} from "@/lib/exercise-labels";
import {
  summarizeWeek,
  type RoutineDayType,
  type RoutineDifficulty,
} from "@/lib/exercise-routine";

import type { HoveredExercise } from "./body-map";
import {
  BuildRoutineDialog,
  type BuildCatalogExercise,
} from "./build-routine-dialog";
import { MuscleExplorer } from "./muscle-explorer";
import { RoutineWeek, type RoutineSlot } from "./routine-week";

/**
 * The exercises surface: your week first, because that's the thing you came
 * to do, and the body-map browser underneath for when you want to go looking.
 *
 * The hovered exercise lives up here because both halves of the page write to
 * it — a row of the week and a card in the catalog both light the same two
 * figures.
 */
export function ExercisesView({
  routineId,
  equipment,
  difficulty,
  daysOfWeek,
  dayTypes,
  slots,
  catalog,
}: {
  routineId: string | null;
  equipment: "YOGA" | "DUMBBELL" | "MIX";
  difficulty: RoutineDifficulty;
  daysOfWeek: number[];
  dayTypes: RoutineDayType[];
  slots: RoutineSlot[];
  catalog: BuildCatalogExercise[];
}) {
  const [building, setBuilding] = useState(false);
  const [hovered, setHovered] = useState<HoveredExercise>(null);

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
      <div className="space-y-12">
        <header className="space-y-2">
          <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
            Undoing the desk
          </p>
          <h1 className="font-display text-display">Exercises</h1>
          <p className="text-muted-foreground max-w-prose text-body">
            A corrective week for the postural patterns a desk builds:
            anterior pelvic tilt, rounded shoulders and forward head. Yoga and
            light dumbbells, up to five exercises a day — your call per day.
          </p>
          {hasRoutine && (
            <p className="text-label text-muted-foreground">
              {daysOfWeek.length} days a week · {daysLabel} ·{" "}
              {ROUTINE_EQUIPMENT_LABELS[equipment]} ·{" "}
              {difficulty === "EASY" ? "gentle — easy exercises" : "challenging"} ·{" "}
              {EQUIPMENT_LABELS.YOGA.toLowerCase()} {week.yoga} /{" "}
              {EQUIPMENT_LABELS.DUMBBELL.toLowerCase()} {week.dumbbell}
            </p>
          )}
        </header>

        {hasRoutine ? (
          <RoutineWeek
            routineId={routineId!}
            equipment={equipment}
            difficulty={difficulty}
            daysOfWeek={daysOfWeek}
            dayTypes={dayTypes}
            slots={slots}
            catalog={catalog}
            onHover={setHovered}
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No routine yet"
            description="Build a weekly plan: pick 1 to 7 days, name the exact days, choose yoga, dumbbells or both, say whether you want it gentle or challenging, and set how many exercises each day carries (1–5)."
            action={
              <Button type="button" onClick={() => setBuilding(true)}>
                <Plus className="size-4" aria-hidden />
                Build your routine
              </Button>
            }
          />
        )}

        {building && (
          <BuildRoutineDialog
            catalog={catalog}
            onClose={() => setBuilding(false)}
          />
        )}

        <MuscleExplorer
          catalog={catalog}
          hovered={hovered}
          onHover={setHovered}
        />
      </div>
    </div>
  );
}
