"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Pin, Plus, RefreshCw, Shuffle, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WEEKDAYS } from "@/lib/dates";
import {
  ROUTINE_DAY_TYPE_LABELS,
  ROUTINE_DIFFICULTY_LABELS,
  ROUTINE_EQUIPMENT_LABELS,
} from "@/lib/exercise-labels";
import type { RoutineDayType, RoutineDifficulty } from "@/lib/exercise-routine";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import {
  deleteRoutine,
  regenerateRoutine,
  toggleExerciseCheckoff,
  unpinRoutineExercise,
} from "../actions";
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
  checkedTodayIds,
  sceneEnabled,
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
  /** Exercise ids already checked off today in the user's timezone. */
  checkedTodayIds: string[];
  /** Whether the Exercises scene is turned on, for toast copy. */
  sceneEnabled: boolean;
  /** Lights the parts this exercise works on the figures below. */
  onHover: (hovered: HoveredExercise) => void;
}) {
  const [swapping, setSwapping] = useState<RoutineSlot | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [, startToggle] = useTransition();
  const router = useRouter();

  const checkedServerSet = new Set(checkedTodayIds);
  const isCheckedToday = (exerciseId: string) =>
    Object.hasOwn(overrides, exerciseId)
      ? overrides[exerciseId]
      : checkedServerSet.has(exerciseId);

  const uniqueRoutineExercises = Array.from(
    new Map(slots.map((slot) => [slot.exercise.id, slot.exercise])).values(),
  );

  const totalCheckedToday = new Set([
    ...checkedTodayIds.filter((id) => overrides[id] !== false),
    ...Object.entries(overrides)
      .filter(([, on]) => on)
      .map(([id]) => id),
  ]).size;

  const handleToggleCheckoff = (exerciseId: string) => {
    const next = !isCheckedToday(exerciseId);
    const wasDoneToday = totalCheckedToday > 0;
    setOverrides((prev) => ({ ...prev, [exerciseId]: next }));

    startToggle(async () => {
      try {
        const state = await toggleExerciseCheckoff(exerciseId);
        if (state.status === "error") {
          toast.error(state.message);
        } else if (state.checked && !wasDoneToday) {
          toast.success(
            sceneEnabled
              ? "Checked off — today counts for the grove."
              : "Checked off for today.",
          );
        }
      } catch {
        toast.error("Couldn't save that check-off. Try again.");
      } finally {
        setOverrides((prev) => {
          const rest = { ...prev };
          delete rest[exerciseId];
          return rest;
        });
      }
    });
  };

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
                <div className="flex flex-1 flex-col">
                  {isToday && (
                    <div className="px-2.5 pb-1.5">
                      {totalCheckedToday > 0 ? (
                        <span className="bg-flow-muted text-flow inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
                          <Check className="size-3 stroke-[2.5]" aria-hidden />
                          Done · {daySlots.filter((s) => isCheckedToday(s.exercise.id)).length}/{daySlots.length}
                        </span>
                      ) : (
                        <p className="text-muted-foreground text-[11px]">
                          Check off 1+ to count today
                        </p>
                      )}
                    </div>
                  )}
                  <ol className="flex-1 space-y-1.5 px-1.5 pb-1.5">
                    {daySlots.map((slot) => (
                      <SlotCard
                        key={slot.position}
                        slot={slot}
                        routineId={routineId}
                        unpinAction={unpinAction}
                        canCheck={isToday}
                        checked={isToday && isCheckedToday(slot.exercise.id)}
                        onToggleCheck={() => handleToggleCheckoff(slot.exercise.id)}
                        onSwap={() => setSwapping(slot)}
                        onHover={onHover}
                      />
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-between gap-2 px-2.5 pb-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-label">Rest</p>
                    {isToday && totalCheckedToday > 0 && (
                      <span className="bg-flow-muted text-flow inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">
                        <Check className="size-3 stroke-[2.5]" aria-hidden />
                        Bonus · {totalCheckedToday} done
                      </span>
                    )}
                    {isToday && totalCheckedToday === 0 && sceneEnabled && (
                      <p className="text-muted-foreground text-[11px] leading-snug">
                        Scene holds steady
                      </p>
                    )}
                  </div>
                  {isToday && uniqueRoutineExercises.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 self-start rounded-full text-[11px] font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Plus className="size-3" aria-hidden />
                          {totalCheckedToday > 0 ? "Edit bonus" : "Did one anyway?"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 space-y-2 p-3">
                        <p className="text-micro font-medium">
                          Check off an exercise today
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          Rest days never cost a stage — checking one off adds a bonus stage.
                        </p>
                        <ul className="max-h-56 space-y-1 overflow-y-auto pt-1">
                          {uniqueRoutineExercises.map((ex) => {
                            const checked = isCheckedToday(ex.id);
                            return (
                              <li key={ex.id}>
                                <button
                                  type="button"
                                  aria-pressed={checked}
                                  onClick={() => handleToggleCheckoff(ex.id)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-label transition-colors",
                                    checked
                                      ? "bg-flow-muted/70 text-foreground font-medium"
                                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "grid size-4 shrink-0 place-items-center rounded-full border",
                                      checked
                                        ? "border-flow bg-flow text-flow-foreground"
                                        : "border-border",
                                    )}
                                    aria-hidden
                                  >
                                    {checked && <Check className="size-2.5 stroke-[3]" />}
                                  </span>
                                  <span className="truncate">{ex.name}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
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
  canCheck,
  checked,
  onToggleCheck,
  onSwap,
  onHover,
}: {
  slot: RoutineSlot;
  routineId: string;
  unpinAction: (formData: FormData) => void;
  canCheck: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onSwap: () => void;
  onHover: (hovered: HoveredExercise) => void;
}) {
  const hoverThis = () =>
    onHover({
      name: slot.exercise.name,
      parts: slot.exercise.bodyParts,
    });

  return (
    <li
      className={cn(
        "rounded-md border transition-colors",
        checked
          ? "border-flow/45 bg-flow-muted/35"
          : "border-border/60 hover:border-primary/40 focus-within:border-primary/40 bg-background/50",
      )}
    >
      <ExerciseDetailDialog
        exercise={slot.exercise}
        canCheck={canCheck}
        checked={checked}
        onToggleCheck={onToggleCheck}
      >
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
                <span
                  className={cn(
                    "hover:text-primary truncate text-label leading-4 font-medium",
                    checked && "text-foreground/75 line-through decoration-flow/60",
                  )}
                >
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

      <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
        {canCheck ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onToggleCheck}
            className={cn(
              "focus-visible:ring-ring inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              checked
                ? "border-flow/40 bg-flow text-flow-foreground"
                : "border-border bg-background/70 text-muted-foreground hover:border-flow/45 hover:text-foreground",
            )}
          >
            <Check className={cn("size-3", checked ? "stroke-[2.75]" : "opacity-55")} aria-hidden />
            <span>{checked ? "Done" : "Check off"}</span>
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-0.5">
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
      </div>
    </li>
  );
}
