"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { goalShort } from "@/lib/exercise-labels";
import type { ExerciseGoal } from "@/lib/exercise-routine";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { swapRoutineExercise } from "../actions";

export type SwapCatalogExercise = {
  id: string;
  name: string;
  equipment: "YOGA" | "DUMBBELL";
  goal: ExerciseGoal;
};

export function SwapDialog({
  routineId,
  dayOfWeek,
  position,
  current,
  catalog,
  onClose,
}: {
  routineId: string;
  dayOfWeek: number;
  position: number;
  current: SwapCatalogExercise;
  catalog: SwapCatalogExercise[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<"YOGA" | "DUMBBELL" | "ALL">("ALL");

  const [state, formAction, pending] = useActionState(swapRoutineExercise, idleState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Swapped.");
      onClose();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter(
      (exercise) =>
        exercise.id !== current.id &&
        (equipment === "ALL" || exercise.equipment === equipment) &&
        (needle === "" || exercise.name.toLowerCase().includes(needle)),
    );
  }, [catalog, current.id, query, equipment]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Swap this exercise</DialogTitle>
          <DialogDescription>
            {current.name} — pick a replacement for this slot. Your swap is kept
            even if you regenerate the routine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the catalog…"
              className="pl-9"
              autoFocus
            />
          </div>

          <ToggleGroup
            type="single"
            variant="outline"
            value={equipment}
            onValueChange={(value) => value && setEquipment(value as typeof equipment)}
            className="justify-start"
          >
            <ToggleGroupItem value="ALL">All</ToggleGroupItem>
            <ToggleGroupItem value="YOGA">Yoga</ToggleGroupItem>
            <ToggleGroupItem value="DUMBBELL">Dumbbells</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {candidates.length === 0 && (
            <p className="text-muted-foreground px-2 py-6 text-center text-label">
              Nothing matches — try a different search or filter.
            </p>
          )}
          {candidates.map((exercise) => (
            <button
              key={exercise.id}
              type="submit"
              disabled={pending}
              form="swap-form"
              name="exerciseId"
              value={exercise.id}
              className={cn(
                "hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors",
                "disabled:opacity-60",
              )}
            >
              <span className="text-body">{exercise.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary">{goalShort(exercise.goal)}</Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {exercise.equipment === "YOGA" ? "Yoga" : "Dumbbells"}
                </Badge>
              </span>
            </button>
          ))}
        </div>

        <form id="swap-form" action={formAction} className="hidden">
          <input type="hidden" name="routineId" value={routineId} />
          <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
          <input type="hidden" name="position" value={position} />
        </form>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
