"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Search, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EXERCISE_DIFFICULTY_LABELS,
  GOAL_LABELS,
  GOAL_ORDER,
  bodyPartLabel,
} from "@/lib/exercise-labels";
import type { ExerciseDifficulty } from "@/lib/exercise-routine";

import type { HoveredExercise } from "./body-map";
import {
  ExerciseDetailDialog,
  type ExerciseDetail,
} from "./exercise-detail-dialog";

type Equipment = "YOGA" | "DUMBBELL";
type Goal = ExerciseDetail["goal"];
type Difficulty = ExerciseDifficulty;

/**
 * The results panel beside the figures: whatever muscle is selected, narrowed
 * further by equipment, goal and name.
 *
 * There is no "body part" dropdown any more — the figure is that control, and
 * two ways to say the same thing is one too many.
 */
export function CatalogSection({
  exercises,
  selectedPart,
  onClearPart,
  onHover,
}: {
  exercises: ExerciseDetail[];
  selectedPart: string | null;
  onClearPart: () => void;
  /** Lights the parts this exercise works on the figures. */
  onHover: (hovered: HoveredExercise) => void;
}) {
  const [equipment, setEquipment] = useState<Equipment | "ALL">("ALL");
  const [goal, setGoal] = useState<Goal | "ALL">("ALL");
  const [difficulty, setDifficulty] = useState<Difficulty | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (selectedPart !== null && !exercise.bodyParts.includes(selectedPart)) {
        return false;
      }
      if (equipment !== "ALL" && exercise.equipment !== equipment) return false;
      if (goal !== "ALL" && exercise.goal !== goal) return false;
      if (difficulty !== "ALL" && exercise.difficulty !== difficulty) {
        return false;
      }
      if (needle !== "" && !exercise.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [exercises, selectedPart, equipment, goal, difficulty, query]);

  const narrowed =
    selectedPart !== null ||
    equipment !== "ALL" ||
    goal !== "ALL" ||
    difficulty !== "ALL" ||
    query !== "";

  const clearEverything = () => {
    onClearPart();
    setEquipment("ALL");
    setGoal("ALL");
    setDifficulty("ALL");
    setQuery("");
  };

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          {selectedPart ? "Targeting" : "The catalog"}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-heading">
            {selectedPart ? bodyPartLabel(selectedPart) : "Every exercise"}
          </h2>
          <span className="text-muted-foreground tnum text-label">
            {filtered.length} of {exercises.length}
          </span>
        </div>
        {selectedPart && (
          <button
            type="button"
            onClick={onClearPart}
            className="text-primary hover:bg-accent -ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-label transition-colors"
          >
            <X className="size-3.5" aria-hidden />
            Clear {bodyPartLabel(selectedPart).toLowerCase()}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            aria-label="Search exercises by name"
            className="h-9 w-40 pl-9"
          />
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          value={equipment}
          onValueChange={(value) => value && setEquipment(value as typeof equipment)}
        >
          <ToggleGroupItem value="ALL">All</ToggleGroupItem>
          <ToggleGroupItem value="YOGA">Yoga</ToggleGroupItem>
          <ToggleGroupItem value="DUMBBELL">Dumbbells</ToggleGroupItem>
        </ToggleGroup>

        <Select value={goal} onValueChange={(value) => setGoal(value as Goal | "ALL")}>
          <SelectTrigger className="h-9 w-44" aria-label="Filter by goal">
            <SelectValue placeholder="Goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Every goal</SelectItem>
            {GOAL_ORDER.map((g) => (
              <SelectItem key={g} value={g}>
                {GOAL_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficulty}
          onValueChange={(value) => setDifficulty(value as Difficulty | "ALL")}
        >
          <SelectTrigger className="h-9 w-36" aria-label="Filter by difficulty">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Every difficulty</SelectItem>
            {(Object.keys(EXERCISE_DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
              <SelectItem key={d} value={d}>
                {EXERCISE_DIFFICULTY_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border space-y-3 rounded-lg border border-dashed py-10 text-center">
          <p className="text-muted-foreground text-label">
            Nothing in the catalog matches all of that.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={clearEverything}>
            Show every exercise
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {filtered.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseDetailDialog exercise={exercise}>
                {(open) => (
                  <button
                    type="button"
                    onClick={open}
                    onMouseEnter={() =>
                      onHover({
                        name: exercise.name,
                        parts: exercise.bodyParts,
                      })
                    }
                    onMouseLeave={() => onHover(null)}
                    onFocus={() =>
                      onHover({
                        name: exercise.name,
                        parts: exercise.bodyParts,
                      })
                    }
                    onBlur={() => onHover(null)}
                    className="border-border hover:border-primary/40 hover:bg-accent bg-card flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-body">{exercise.name}</span>
                      {exercise.equipment === "YOGA" ? (
                        <Sparkles
                          className="text-primary size-4 shrink-0"
                          aria-label="Yoga"
                        />
                      ) : (
                        <Dumbbell
                          className="text-primary size-4 shrink-0"
                          aria-label="Dumbbells"
                        />
                      )}
                    </span>
                    <span className="text-muted-foreground text-label">
                      {exercise.prescription}
                    </span>
                    <span className="flex flex-wrap gap-1 pt-1">
                      <Badge variant="secondary" className="text-[0.625rem]">
                        {GOAL_LABELS[exercise.goal]}
                      </Badge>
                      <Badge variant="outline" className="text-[0.625rem]">
                        {EXERCISE_DIFFICULTY_LABELS[exercise.difficulty]}
                      </Badge>
                      {exercise.bodyParts.slice(0, 2).map((part) => (
                        <Badge
                          key={part}
                          variant="outline"
                          className="text-[0.625rem]"
                        >
                          {bodyPartLabel(part)}
                        </Badge>
                      ))}
                      {exercise.bodyParts.length > 2 && (
                        <Badge variant="outline" className="text-[0.625rem]">
                          +{exercise.bodyParts.length - 2}
                        </Badge>
                      )}
                    </span>
                  </button>
                )}
              </ExerciseDetailDialog>
            </li>
          ))}
        </ul>
      )}

      {narrowed && filtered.length > 0 && (
        <button
          type="button"
          onClick={clearEverything}
          className="text-muted-foreground hover:text-foreground text-label transition-colors"
        >
          Clear all filters
        </button>
      )}
    </section>
  );
}
