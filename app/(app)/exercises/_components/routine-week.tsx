"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Pin, RefreshCw, Shuffle, Sparkles, Star, Trash2 } from "lucide-react";
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
import { ExerciseMiniFigure } from "./exercise-mini-figure";
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
 * The week as columns — the plan-first layout. The week's rhythm is the thing
 * worth seeing: training days raised and carrying their slots, rest days
 * recessed and dashed, today wearing a chip so the plan and the day you're
 * actually in meet in one glance. Seven stacked rows said the same words one
 * day at a time; columns say the week.
 *
 * Down to phone width the columns stack back into days, and the layout reads
 * as the row list it replaced.
 */
export function RoutineWeek({
  routineId,
  equipment,
  difficulty,
  daysOfWeek,
  dayTypes,
  slots,
  catalog,
  todayDow,
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
  /** Today's weekday (0–6, Sunday first) — the chip on the grid. */
  todayDow: number;
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {WEEKDAYS.map((day) => {
          const training = daysOfWeek.includes(day.value);
          const daySlots = slotsByDay(day.value);
          const dayType = dayTypeByDay.get(day.value);
          const isToday = day.value === todayDow;

          return (
            <div
              key={day.value}
              className={cn(
                "flex flex-col rounded-lg border transition-colors",
                training
                  ? "border-border bg-card"
                  : "border-border/70 border-dashed opacity-60",
                isToday && training && "border-primary/50 ring-primary/15 ring-1",
              )}
            >
              <div className="flex items-baseline justify-between gap-1 px-2.5 pt-2.5 pb-1.5">
                <p
                  className={cn(
                    "font-display text-title",
                    !training && "text-muted-foreground",
                  )}
                >
                  {day.short}
                </p>
                {isToday ? (
                  <span className="bg-accent text-accent-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-micro font-medium">
                    <Star className="size-2.5 fill-current" aria-hidden />
                    Today
                  </span>
                ) : training ? (
                  <span className="text-micro text-muted-foreground truncate tracking-wide uppercase">
                    {ROUTINE_DAY_TYPE_LABELS[dayType ?? "STANDARD"]}
                  </span>
                ) : null}
              </div>

              {training ? (
                <ol className="flex-1 space-y-1.5 px-1.5 pb-1.5">
                  {daySlots.map((slot) => (
                    <SlotCard
                      key={slot.position}
                      slot={slot}
                      routineId={routineId}
                      unpinAction={unpinAction}
                      onSwap={() => setSwapping(slot)}
                      onHover={onHover}
                    />
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground px-2.5 pb-3 text-label">
                  Rest
                </p>
              )}
            </div>
          );
        })}
      </div>

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

/**
 * One exercise in a day column: the thumbnail figure above the fold of the
 * card, the name and prescription beside it, and its two actions always
 * visible — a hover-revealed control is invisible on a phone, and "swap this
 * exercise" is exactly the decision a column exists to invite.
 */
function SlotCard({
  slot,
  routineId,
  unpinAction,
  onSwap,
  onHover,
}: {
  slot: RoutineSlot;
  routineId: string;
  unpinAction: (formData: FormData) => void;
  onSwap: () => void;
  onHover: (hovered: HoveredExercise) => void;
}) {
  const hoverThis = () =>
    onHover({
      name: slot.exercise.name,
      parts: slot.exercise.bodyParts,
    });

  return (
    <li className="border-border/60 hover:border-primary/40 focus-within:border-primary/40 rounded-md border bg-background/50 transition-colors">
      <ExerciseDetailDialog exercise={slot.exercise}>
        {(open) => (
          <button
            type="button"
            onClick={open}
            onMouseEnter={hoverThis}
            onMouseLeave={() => onHover(null)}
            onFocus={hoverThis}
            onBlur={() => onHover(null)}
            title={`${slot.exercise.name} — ${slot.exercise.prescription}`}
            className="focus-visible:ring-ring flex w-full items-start gap-2 rounded-md p-1.5 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <ExerciseMiniFigure parts={slot.exercise.bodyParts} />
            <span className="min-w-0 flex-1 self-center">
              <span className="flex items-baseline gap-1">
                <span
                  className="text-muted-foreground tnum shrink-0 text-micro"
                  aria-hidden
                >
                  {slot.position + 1}
                </span>
                <span className="hover:text-primary truncate text-label leading-4 font-medium">
                  {slot.exercise.name}
                </span>
              </span>
              <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-micro">
                {slot.exercise.equipment === "YOGA" ? (
                  <Sparkles className="size-3 shrink-0" aria-hidden />
                ) : (
                  <Dumbbell className="size-3 shrink-0" aria-hidden />
                )}
                <span className="truncate">{slot.exercise.prescription}</span>
              </span>
            </span>
          </button>
        )}
      </ExerciseDetailDialog>

      <div className="flex items-center justify-end gap-0.5 pb-1 pr-1">
        {slot.swapped && (
          <form action={unpinAction}>
            <input type="hidden" name="routineId" value={routineId} />
            <input type="hidden" name="dayOfWeek" value={slot.dayOfWeek} />
            <input type="hidden" name="position" value={slot.position} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="text-primary size-6"
              title="Pinned — Regenerate leaves this one alone. Click to release it."
            >
              <span className="sr-only">Unpin {slot.exercise.name}</span>
              <Pin className="size-3 fill-current" aria-hidden />
            </Button>
          </form>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-6"
          onClick={onSwap}
        >
          <Shuffle className="size-3" aria-hidden />
          <span className="sr-only">Swap {slot.exercise.name}</span>
        </Button>
      </div>
    </li>
  );
}
