/**
 * Display labels for the exercise enums — the only place the codes become
 * words, so the catalog, the routine and the dialogs all speak the same
 * language.
 */

import type { ExerciseGoal } from "@/lib/exercise-routine";

export const EQUIPMENT_LABELS: Record<"YOGA" | "DUMBBELL", string> = {
  YOGA: "Yoga",
  DUMBBELL: "Dumbbells",
};

/** The routine's catalog choice, as a display string. */
export const ROUTINE_EQUIPMENT_LABELS: Record<
  "YOGA" | "DUMBBELL" | "MIX",
  string
> = {
  YOGA: "yoga only",
  DUMBBELL: "dumbbells only",
  MIX: "yoga & dumbbells",
};

export const GOAL_LABELS: Record<ExerciseGoal, string> = {
  HIP_FLEXOR_MOBILITY: "Hip flexor mobility",
  GLUTE_STRENGTH: "Glute strength",
  HAMSTRING_LENGTH: "Hamstring length",
  CORE_STABILITY: "Core stability",
  LOWER_BACK_RELIEF: "Lower back relief",
  UPPER_BACK_STRENGTH: "Upper back strength",
  CHEST_MOBILITY: "Chest mobility",
  POSTURE_AWARENESS: "Posture awareness",
};

export const GOAL_SHORT: Record<ExerciseGoal, string> = {
  HIP_FLEXOR_MOBILITY: "Hip flexors",
  GLUTE_STRENGTH: "Glutes",
  HAMSTRING_LENGTH: "Hamstrings",
  CORE_STABILITY: "Core",
  LOWER_BACK_RELIEF: "Lower back",
  UPPER_BACK_STRENGTH: "Upper back",
  CHEST_MOBILITY: "Chest",
  POSTURE_AWARENESS: "Posture",
};

export const GOAL_ORDER: ExerciseGoal[] = [
  "GLUTE_STRENGTH",
  "HAMSTRING_LENGTH",
  "CORE_STABILITY",
  "HIP_FLEXOR_MOBILITY",
  "LOWER_BACK_RELIEF",
  "UPPER_BACK_STRENGTH",
  "CHEST_MOBILITY",
  "POSTURE_AWARENESS",
];

export const BODY_PART_LABELS: Record<string, string> = {
  HIP_FLEXORS: "Hip flexors",
  QUADS: "Quads",
  GLUTES: "Glutes",
  HAMSTRINGS: "Hamstrings",
  CORE: "Core",
  LOWER_BACK: "Lower back",
  UPPER_BACK: "Upper back",
  SHOULDERS: "Shoulders",
  CHEST: "Chest",
  SPINE: "Spine",
  FULL_BODY: "Full body",
};

/** Sentence-case a goal code for inline chips. */
export function goalShort(goal: ExerciseGoal): string {
  return GOAL_SHORT[goal];
}

export function bodyPartLabel(part: string): string {
  return BODY_PART_LABELS[part] ?? part;
}
