"use client";

import { useActionState, useEffect, useState } from "react";
import { Dumbbell, RefreshCw, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/dates";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { deleteRoutine, regenerateRoutine } from "../actions";
import {
  ExerciseDetailDialog,
  type ExerciseDetail,
} from "./exercise-detail-dialog";
import { SwapDialog, type SwapCatalogExercise } from "./swap-dialog";

/** One row of the week: a slot of one workout day. */
export type RoutineSlot = {
  dayOfWeek: number;
  position: number;
  exercise: ExerciseDetail;
};

/**
 * The week, as a grid of day strips — the plan-first layout. Workout days are
 * raised and carry their three slots; the off days are quiet, staying in the
 * grid so the rhythm of the week is visible at a glance.
 */
export function RoutineWeek({
  routineId,
  daysOfWeek,
  slots,
  catalog,
}: {
  routineId: string;
  daysOfWeek: number[];
  slots: RoutineSlot[];
  catalog: SwapCatalogExercise[];
}) {
  const [swapping, setSwapping] = useState<RoutineSlot | null>(null);

  const [regenerateState, regenerateAction, regenerating] = useActionState(
    regenerateRoutine,
    idleState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(deleteRoutine, idleState);

  useEffect(() => {
    if (regenerateState.status === "success") {
      toast.success(regenerateState.message ?? "Routine regenerated.");
    } else if (regenerateState.status === "error") {
      toast.error(regenerateState.message);
    }
  }, [regenerateState]);

  useEffect(() => {
    if (deleteState.status === "success") {
      toast.success(deleteState.message ?? "Routine removed.");
    } else if (deleteState.status === "error") {
      toast.error(deleteState.message);
    }
  }, [deleteState]);

  const slotsByDay = (day: number) =>
    slots
      .filter((slot) => slot.dayOfWeek === day)
      .sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((day) => {
        const training = daysOfWeek.includes(day.value);
        const daySlots = slotsByDay(day.value);
        return (
          <div
            key={day.value}
            className={cn(
              "border-border rounded-lg border transition-colors",
              training
                ? "bg-card"
                : "border-dashed opacity-50",
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
                {training ? `${daySlots.length} exercises` : "Rest day"}
              </p>
            </div>

            {training ? (
              <ol className="divide-y p-0">
                {daySlots.map((slot) => (
                  <li
                    key={slot.position}
                    className="flex items-center gap-3 px-4 py-3"
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

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <ConfirmDialog
          trigger={(open) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={regenerating}
              onClick={open}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Regenerate
            </Button>
          )}
          title="Regenerate the week?"
          description="Your manually swapped exercises stay; everything else gets reshuffled."
          confirmLabel="Regenerate"
          pendingLabel="Regenerating…"
          cancelLabel="Keep as is"
          onConfirm={async () => {
            const formData = new FormData();
            formData.set("routineId", routineId);
            regenerateAction(formData);
          }}
        />

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
          }}
          catalog={catalog}
          onClose={() => setSwapping(null)}
        />
      )}
    </div>
  );
}
