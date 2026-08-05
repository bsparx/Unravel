"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Dumbbell, Sparkles } from "lucide-react";
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
 * The builder, in three steps: the shape of the week (3/4/5 days), the exact
 * days, then a preview of what the generator composed — which is saved as-is,
 * because the server generates identically from the same catalog order.
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
    return generateRoutine({ days, exercises: catalog });
  }, [step, days, catalog]);

  const toggleDay = (value: number) => {
    setDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : current.length < daysPerWeek
          ? [...current, value]
          : current,
    );
  };

  const picked = new Set(days);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Build your routine</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — never more than three exercises a day, ever.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-label text-muted-foreground">
              How many days a week will you train?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ROUTINE_DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDaysPerWeek(option);
                    setDays([]);
                  }}
                  className={cn(
                    "border-border hover:bg-accent flex flex-col items-center gap-1 rounded-lg border px-4 py-4 transition-colors",
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
            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep(2)}>
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
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
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                disabled={days.length !== daysPerWeek}
                onClick={() => setStep(3)}
              >
                Preview routine
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-label text-muted-foreground">
              Here is what the week looks like. Save it, or go back and change
              the days — you can swap individual exercises after.
            </p>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {WEEKDAYS.filter((day) => picked.has(day.value)).map((day) => {
                const daySlots = preview.filter((slot) => slot.dayOfWeek === day.value);
                return (
                  <div key={day.value} className="border-border rounded-lg border">
                    <p className="font-display text-body px-3 pt-2.5">{day.long}</p>
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
                ≤3 per day
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
              {days.map((day) => (
                <input key={day} type="hidden" name="days[]" value={day} />
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
