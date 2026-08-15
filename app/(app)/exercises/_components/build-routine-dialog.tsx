"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Dumbbell, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEEKDAYS } from "@/lib/dates";
import { generateRoutine } from "@/lib/exercise-routine";
import { idleState, ROUTINE_DAY_OPTIONS } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createRoutine } from "../actions";
import type { ExerciseDetail } from "./exercise-detail-dialog";

export type BuildCatalogExercise = ExerciseDetail;

/**
 * The builder, in three steps: the shape of the week (how many days and
 * which ones — all seven auto-selected when "7 days" is chosen), then how
 * many exercises each day carries, then the generated week to review and
 * save. Saved as-is, because the server generates identically from the same
 * catalog order.
 */
export function BuildRoutineDialog({
  catalog,
  onClose,
}: {
  catalog: BuildCatalogExercise[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [days, setDays] = useState<number[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [equipment, setEquipment] = useState<"YOGA" | "DUMBBELL" | "MIX">(
    "MIX",
  );

  const [state, formAction, pending] = useActionState(createRoutine, idleState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Routine built.");
      onClose();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  const nameById = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise.name])),
    [catalog],
  );

  /** Client preview of what the server will build — same inputs, same output. */
  const preview = useMemo(() => {
    if (step !== 3) return [];
    const sorted = [...days].sort((a, b) => a - b);
    return generateRoutine({
      days: sorted,
      counts: sorted.map((day) => counts[day] ?? 3),
      exercises: catalog,
      equipment: equipment === "MIX" ? null : equipment,
    });
  }, [step, days, counts, catalog, equipment]);

  const toggleDay = (value: number) => {
    if (days.includes(value)) {
      setDays(days.filter((day) => day !== value));
      return;
    }
    if (days.length >= daysPerWeek) return;
    setDays([...days, value]);
    setCounts((current) => ({ ...current, [value]: 3 }));
  };

  const picked = new Set(days);
  const totalExercises = days.reduce((sum, day) => sum + (counts[day] ?? 3), 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Build your routine</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — up to five exercises a day, your call.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-label text-muted-foreground">
              How many days a week will you train?
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ROUTINE_DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDaysPerWeek(option);
                    // Seven days is unambiguous — pre-select the whole week.
                    setDays(option === 7 ? [0, 1, 2, 3, 4, 5, 6] : []);
                    setCounts({});
                  }}
                  className={cn(
                    "border-border hover:bg-accent flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-colors",
                    daysPerWeek === option && "border-primary bg-accent",
                  )}
                >
                  <span className="font-display text-heading tnum">{option}</span>
                  <span className="text-micro text-muted-foreground tracking-wide uppercase">
                    days
                  </span>
                </button>
              ))}
            </div>

            <p className="text-label text-muted-foreground">
              What will you train with?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "YOGA", label: "Yoga only", icon: Sparkles },
                  { value: "DUMBBELL", label: "Dumbbells only", icon: Dumbbell },
                  { value: "MIX", label: "Mix of both", icon: Shuffle },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEquipment(value)}
                  aria-pressed={equipment === value}
                  className={cn(
                    "border-border hover:bg-accent flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-colors",
                    equipment === value && "border-primary bg-accent",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="text-label">{label}</span>
                </button>
              ))}
            </div>

            {daysPerWeek < 7 ? (
              <>
                <p className="text-label text-muted-foreground">
                  Pick exactly {daysPerWeek} days — those are the ones that count.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      aria-pressed={picked.has(day.value)}
                      className={cn(
                        "border-border hover:bg-accent flex flex-col items-center gap-0.5 rounded-lg border px-2 py-3 transition-colors",
                        picked.has(day.value) && "border-primary bg-accent",
                        !picked.has(day.value) && days.length === daysPerWeek && "opacity-40",
                      )}
                    >
                      <span className="font-display text-body">{day.short}</span>
                      <span className="text-muted-foreground text-micro tracking-wide uppercase">
                        {day.letter}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-label">
                  {days.length} of {daysPerWeek} picked
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-label">
                Every day — no rest days.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={days.length !== daysPerWeek}
                onClick={() => setStep(2)}
              >
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-label text-muted-foreground">
              Set how many exercises each day carries — 1 to 5.
            </p>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {WEEKDAYS.filter((day) => picked.has(day.value)).map((day) => {
                const count = counts[day.value] ?? 3;
                return (
                  <div
                    key={day.value}
                    className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                  >
                    <p className="font-display text-body">{day.long}</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={"Fewer exercises on " + day.long}
                        disabled={count <= 1}
                        onClick={() =>
                          setCounts((current) => ({
                            ...current,
                            [day.value]: Math.max(1, (current[day.value] ?? 3) - 1),
                          }))
                        }
                        className="border-border hover:bg-accent disabled:text-muted-foreground/40 flex size-6 items-center justify-center rounded-md border text-label transition-colors"
                      >
                        −
                      </button>
                      <span
                        className="text-label tnum w-6 text-center"
                        aria-live="polite"
                      >
                        {count}
                      </span>
                      <button
                        type="button"
                        aria-label={"More exercises on " + day.long}
                        disabled={count >= 5}
                        onClick={() =>
                          setCounts((current) => ({
                            ...current,
                            [day.value]: Math.min(5, (current[day.value] ?? 3) + 1),
                          }))
                        }
                        className="border-border hover:bg-accent disabled:text-muted-foreground/40 flex size-6 items-center justify-center rounded-md border text-label transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-muted-foreground">
                {totalExercises} exercises
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                ≤5 per day
              </Badge>
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)}>
                Preview exercises
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-label text-muted-foreground">
              Here is the week the generator built — save it when it looks right,
              and you can swap any exercise from the routine after.
            </p>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {WEEKDAYS.filter((day) => picked.has(day.value)).map((day) => {
                const daySlots = preview.filter(
                  (slot) => slot.dayOfWeek === day.value,
                );
                return (
                  <div key={day.value} className="border-border rounded-lg border">
                    <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                      <p className="font-display text-body">{day.long}</p>
                      <span className="text-muted-foreground text-micro tracking-wide uppercase">
                        {daySlots.length} exercises
                      </span>
                    </div>
                    <ol className="divide-y">
                      {daySlots.map((slot) => {
                        const exercise = catalog.find((e) => e.id === slot.exerciseId);
                        return (
                          <li key={slot.position} className="flex items-center gap-2.5 px-3 py-2">
                            <span className="text-muted-foreground tnum text-label w-4 text-center">
                              {slot.position + 1}
                            </span>
                            <span className="text-label min-w-0 flex-1 truncate">
                              {nameById.get(slot.exerciseId) ?? "—"}
                            </span>
                            {exercise?.equipment === "YOGA" ? (
                              <Sparkles className="text-muted-foreground size-3.5" aria-hidden />
                            ) : (
                              <Dumbbell className="text-muted-foreground size-3.5" aria-hidden />
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-muted-foreground">
                {preview.length} exercises
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                ≤5 per day
              </Badge>
            </div>

            <form action={formAction} className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <input type="hidden" name="daysPerWeek" value={daysPerWeek} />
              <input type="hidden" name="equipment" value={equipment} />
              {[...days].sort((a, b) => a - b).map((day) => (
                <input key={day} type="hidden" name="days[]" value={day} />
              ))}
              {[...days].sort((a, b) => a - b).map((day) => (
                <input
                  key={"count-" + day}
                  type="hidden"
                  name="counts[]"
                  value={counts[day] ?? 3}
                />
              ))}
              <Button type="submit" disabled={pending}>
                {pending ? "Building…" : "Save this routine"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
