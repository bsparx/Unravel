"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Pin, RefreshCw, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/dates";
import {
  ROUTINE_DAY_TYPE_LABELS,
  ROUTINE_DIFFICULTY_LABELS,
  ROUTINE_EQUIPMENT_LABELS,
} from "@/lib/exercise-labels";
import type { RoutineDayType, RoutineDifficulty } from "@/lib/exercise-routine";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { deleteRoutine, regenerateRoutine, unpinRoutineExercise } from "../actions";
import type { HoveredExercise } from "./body-map";
import {
  ExerciseDetailDialog,
  type ExerciseDetail,
} from "./exercise-detail-dialog";
import { SwapDialog, type SwapCatalogExercise } from "./swap-dialog";

/** One row of the week: a slot of one workout day. */
export type RoutineSlot = {
  dayOfWeek: number;
  position: number;
  /** Chosen by hand, so regeneration leaves it alone. */
  swapped: boolean;
  exercise: ExerciseDetail;
};

/**
 * The week, as a grid of day strips — the plan-first layout. Workout days are
 * raised and carry their slots; the off days are quiet, staying in the grid
 * so the rhythm of the week is visible at a glance.
 */
export function RoutineWeek({
  routineId,
  equipment,
  difficulty,
  daysOfWeek,
  dayTypes,
  slots,
  catalog,
  onHover,
}: {
  routineId: string;
  equipment: "YOGA" | "DUMBBELL" | "MIX";
  difficulty: RoutineDifficulty;
  daysOfWeek: number[];
  /** Index-aligned with `daysOfWeek`, as stored on the routine. */
  dayTypes: RoutineDayType[];
  slots: RoutineSlot[];
  catalog: SwapCatalogExercise[];
  /** Lights the parts this exercise works on the figures below. */
  onHover: (hovered: HoveredExercise) => void;
}) {
  const [swapping, setSwapping] = useState<RoutineSlot | null>(null);
  const router = useRouter();

  // Regenerate and unpin are submitted as real forms, so Next folds the
  // revalidated week straight back into the tree. Delete is fired from a
  // confirmation dialog instead, which is why only it needs a refresh.
  const [regenerateState, regenerateAction, regenerating] = useActionState(
    regenerateRoutine,
    idleState,
  );
  const [unpinState, unpinAction] = useActionState(unpinRoutineExercise, idleState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteRoutine, idleState);

  useEffect(() => {
    if (regenerateState.status === "success") {
      toast.success(regenerateState.message ?? "Routine regenerated.");
    } else if (regenerateState.status === "error") {
      toast.error(regenerateState.message);
    }
  }, [regenerateState]);

  useEffect(() => {
    if (unpinState.status === "error") toast.error(unpinState.message);
  }, [unpinState]);

  useEffect(() => {
    if (deleteState.status === "success") {
      toast.success(deleteState.message ?? "Routine removed.");
      router.refresh();
    } else if (deleteState.status === "error") {
      toast.error(deleteState.message);
    }
  }, [deleteState, router]);

  const slotsByDay = (day: number) =>
    slots
      .filter((slot) => slot.dayOfWeek === day)
      .sort((a, b) => a.position - b.position);

  const dayTypeByDay = new Map(
    daysOfWeek.map((day, index) => [day, dayTypes[index] ?? "STANDARD"]),
  );

  const pinned = slots.filter((slot) => slot.swapped).length;

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((day) => {
        const training = daysOfWeek.includes(day.value);
        const daySlots = slotsByDay(day.value);
        const dayType = dayTypeByDay.get(day.value);
        return (
          <div
            key={day.value}
            className={cn(
              "border-border rounded-lg border transition-colors",
              training ? "bg-card" : "border-dashed opacity-50",
            )}
          >
            <div className="flex items-baseline justify-between px-4 pt-3">
              <p
                className={cn(
                  "font-display text-title",
                  !training && "text-muted-foreground",
                )}
              >
                {day.long}
              </p>
              <p className="text-micro text-muted-foreground tracking-wide uppercase">
                {training
                  ? `${ROUTINE_DAY_TYPE_LABELS[dayType ?? "STANDARD"]} · ${daySlots.length} ${daySlots.length === 1 ? "exercise" : "exercises"}`
                  : "Rest day"}
              </p>
            </div>

            {training ? (
              <ol className="divide-y p-0">
                {daySlots.map((slot) => (
                  <li
                    key={slot.position}
                    className="flex items-center gap-3 px-4 py-3"
                    onMouseEnter={() =>
                      onHover({
                        name: slot.exercise.name,
                        parts: slot.exercise.bodyParts,
                      })
                    }
                    onMouseLeave={() => onHover(null)}
                  >
                    <span
                      className="text-muted-foreground tnum w-5 shrink-0 text-center text-label"
                      aria-hidden
                    >
                      {slot.position + 1}
                    </span>

                    <ExerciseDetailDialog exercise={slot.exercise}>
                      {(open) => (
                        <button
                          type="button"
                          onClick={open}
                          onFocus={() =>
                            onHover({
                              name: slot.exercise.name,
                              parts: slot.exercise.bodyParts,
                            })
                          }
                          onBlur={() => onHover(null)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="text-body hover:text-primary block truncate font-medium">
                            {slot.exercise.name}
                          </span>
                          <span className="text-muted-foreground text-micro tracking-wide uppercase">
                            {slot.exercise.prescription}
                          </span>
                        </button>
                      )}
                    </ExerciseDetailDialog>

                    {slot.swapped && (
                      <form action={unpinAction} className="shrink-0">
                        <input type="hidden" name="routineId" value={routineId} />
                        <input type="hidden" name="dayOfWeek" value={slot.dayOfWeek} />
                        <input type="hidden" name="position" value={slot.position} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-primary"
                          title="Pinned — Regenerate leaves this one alone. Click to release it."
                        >
                          <Pin className="size-3.5 fill-current" aria-hidden />
                          <span className="sr-only">
                            Unpin {slot.exercise.name}
                          </span>
                        </Button>
                      </form>
                    )}

                    <span
                      className="text-muted-foreground shrink-0"
                      aria-label={slot.exercise.equipment}
                      title={slot.exercise.equipment === "YOGA" ? "Yoga" : "Dumbbells"}
                    >
                      {slot.exercise.equipment === "YOGA" ? (
                        <Sparkles className="size-4" aria-hidden />
                      ) : (
                        <Dumbbell className="size-4" aria-hidden />
                      )}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSwapping(slot)}
                    >
                      <Shuffle className="size-3.5" aria-hidden />
                      <span className="sr-only">Swap {slot.exercise.name}</span>
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground px-4 pb-4 text-label">
                Nothing scheduled — your chosen rest.
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <p className="text-muted-foreground text-label">
          {pinned > 0
            ? `${pinned} pinned — Regenerate reshuffles the rest.`
            : `Regenerate draws a fresh week from the ${ROUTINE_DIFFICULTY_LABELS[difficulty]} ${ROUTINE_EQUIPMENT_LABELS[equipment]} catalog.`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <form action={regenerateAction}>
            <input type="hidden" name="routineId" value={routineId} />
            <Button type="submit" variant="outline" size="sm" disabled={regenerating}>
              <RefreshCw
                className={cn("size-3.5", regenerating && "animate-spin")}
                aria-hidden
              />
              {regenerating ? "Reshuffling…" : "Regenerate"}
            </Button>
          </form>

          <ConfirmDialog
            trigger={(open) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={deleting}
                onClick={open}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Rebuild from scratch
              </Button>
            )}
            title="Rebuild your routine?"
            description="This routine is removed, including your swaps. You'll build a fresh one from the same catalog."
            confirmLabel="Rebuild"
            pendingLabel="Rebuilding…"
            cancelLabel="Keep it"
            onConfirm={async () => {
              const formData = new FormData();
              formData.set("routineId", routineId);
              deleteAction(formData);
            }}
          />
        </div>
      </div>

      {swapping && (
        <SwapDialog
          routineId={routineId}
          dayOfWeek={swapping.dayOfWeek}
          position={swapping.position}
          current={{
            id: swapping.exercise.id,
            name: swapping.exercise.name,
            equipment: swapping.exercise.equipment,
            goal: swapping.exercise.goal,
            difficulty: swapping.exercise.difficulty,
          }}
          catalog={catalog}
          onClose={() => setSwapping(null)}
        />
      )}
    </div>
  );
}
