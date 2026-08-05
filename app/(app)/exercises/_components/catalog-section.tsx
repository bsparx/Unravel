"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GOAL_LABELS, GOAL_ORDER, bodyPartLabel } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import {
  ExerciseDetailDialog,
  type ExerciseDetail,
} from "./exercise-detail-dialog";

type Equipment = "YOGA" | "DUMBBELL";
type Goal = ExerciseDetail["goal"];

/**
 * The full catalog, filterable three ways — equipment, goal, body part —
 * plus a name search. A card opens the detail dialog; the routine and the
 * swap picker both draw from this same data.
 */
export function CatalogSection({ exercises }: { exercises: ExerciseDetail[] }) {
  const [equipment, setEquipment] = useState<Equipment | "ALL">("ALL");
  const [goal, setGoal] = useState<Goal | "ALL">("ALL");
  const [bodyPart, setBodyPart] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const bodyParts = useMemo(
    () => [...new Set(exercises.flatMap((exercise) => exercise.bodyParts))],
    [exercises],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (equipment !== "ALL" && exercise.equipment !== equipment) return false;
      if (goal !== "ALL" && exercise.goal !== goal) return false;
      if (bodyPart !== "ALL" && !exercise.bodyParts.includes(bodyPart)) return false;
      if (needle !== "" && !exercise.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [exercises, equipment, goal, bodyPart, query]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-heading">Catalog</h2>
          <p className="text-muted-foreground text-label">
            {exercises.length} corrective exercises · yoga and light dumbbells
          </p>
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

          <Select
            value={goal}
            onValueChange={(value) => setGoal(value as Goal | "ALL")}
          >
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
            value={bodyPart}
            onValueChange={(value) => setBodyPart(value)}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Filter by body part">
              <SelectValue placeholder="Body part" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Every body part</SelectItem>
              {bodyParts.map((part) => (
                <SelectItem key={part} value={part}>
                  {bodyPartLabel(part)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-label">
          Nothing matches those filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseDetailDialog exercise={exercise}>
                {(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className={cn(
                      "border-border hover:bg-accent bg-card flex h-full w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                    )}
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
    </section>
  );
}
