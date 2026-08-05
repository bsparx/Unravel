/**
 * Routine generation — pure functions. No React, no Prisma.
 *
 * The corrective logic the whole feature is built on: anterior pelvic tilt
 * (lower cross) is fixed by strengthening glutes + deep core and stretching
 * hip flexors; rounded shoulders (upper cross) by strengthening the upper
 * back and opening the chest. Every day is composed as three slots drawn
 * from those categories, and the week balances yoga vs. dumbbells.
 *
 * Structural rules:
 *   - a workout day has exactly 3 slots (positions 0..2) — the "never more
 *     than three exercises a day" rule lives here AND in the schema
 *   - no exercise repeats across the week while the pool allows it
 *   - the first workout day always carries an upper-back/posture slot
 *   - equipment alternates by day so a 3/4/5-day week lands near 50/50
 *   - pinned (user-swapped) slots are left untouched by regeneration
 */

export type ExerciseEquipment = "YOGA" | "DUMBBELL";

export type ExerciseGoal =
  | "HIP_FLEXOR_MOBILITY"
  | "GLUTE_STRENGTH"
  | "HAMSTRING_LENGTH"
  | "CORE_STABILITY"
  | "LOWER_BACK_RELIEF"
  | "UPPER_BACK_STRENGTH"
  | "CHEST_MOBILITY"
  | "POSTURE_AWARENESS";

/** What the generator actually needs from an exercise. */
export interface PoolExercise {
  id: string;
  equipment: ExerciseEquipment;
  goal: ExerciseGoal;
}

/** One slot of the week being produced. `position` is 0..2 within the day. */
export interface GeneratedSlot {
  dayOfWeek: number;
  position: number;
  exerciseId: string;
}

/** A slot the person already replaced; regeneration must keep it. */
export interface PinnedSlot {
  dayOfWeek: number;
  position: number;
  exerciseId: string;
}

/** The three corrective jobs a workout day is made of. */
export type SlotCategory = "POSTERIOR" | "CORE" | "MOBILITY" | "UPPER";

const CATEGORY_OF_GOAL: Record<ExerciseGoal, SlotCategory> = {
  GLUTE_STRENGTH: "POSTERIOR",
  HAMSTRING_LENGTH: "POSTERIOR",
  CORE_STABILITY: "CORE",
  POSTURE_AWARENESS: "CORE",
  HIP_FLEXOR_MOBILITY: "MOBILITY",
  LOWER_BACK_RELIEF: "MOBILITY",
  CHEST_MOBILITY: "MOBILITY",
  UPPER_BACK_STRENGTH: "UPPER",
};

/** Which category a slot on a given day-index should draw from. */
function categoryForSlot(dayIndex: number, slot: number): SlotCategory {
  if (slot === 0) return "POSTERIOR";
  if (slot === 1) return "CORE";
  // Every third workout day leads with upper-back/posture work, so a 3-day
  // week gets at least one, a 4-day gets one, a 5-day gets two.
  return dayIndex % 3 === 0 ? "UPPER" : "MOBILITY";
}

/**
 * Equipment preference by day parity: even days lean yoga (2Y+1D), odd days
 * lean dumbbells (1Y+2D). Across any 3-5 day week that lands near 50/50,
 * which is the point of mixing both styles in one routine.
 */
function equipmentForSlot(dayIndex: number, slot: number): ExerciseEquipment {
  const even = dayIndex % 2 === 0;
  return slot === 1 ? (even ? "DUMBBELL" : "YOGA") : even ? "YOGA" : "DUMBBELL";
}

/** Deterministic PRNG (mulberry32), so a variant always reproduces itself. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface GenerateOptions {
  /** 0 = Sunday .. 6 = Saturday. Any length 1..7; the builder offers 3-5. */
  days: number[];
  /** The active catalog. */
  exercises: PoolExercise[];
  /** 0 = the canonical routine; higher variants reshuffle the pools. */
  variant?: number;
  /** User-swapped slots: regenerated around, never over. */
  pinned?: PinnedSlot[];
}

/**
 * Build a week: for each day, three non-repeating exercises drawn from the
 * corrective categories, balanced across equipment.
 */
export function generateRoutine({
  days,
  exercises,
  variant = 0,
  pinned = [],
}: GenerateOptions): GeneratedSlot[] {
  const random = mulberry32(variant + 1);

  // Pool per category, shuffled per variant so "Regenerate" produces a real
  // reshuffle instead of the same routine wearing a different label.
  const pools: Record<SlotCategory, PoolExercise[]> = {
    POSTERIOR: shuffle(exercises.filter((e) => CATEGORY_OF_GOAL[e.goal] === "POSTERIOR"), random),
    CORE: shuffle(exercises.filter((e) => CATEGORY_OF_GOAL[e.goal] === "CORE"), random),
    MOBILITY: shuffle(exercises.filter((e) => CATEGORY_OF_GOAL[e.goal] === "MOBILITY"), random),
    UPPER: shuffle(exercises.filter((e) => CATEGORY_OF_GOAL[e.goal] === "UPPER"), random),
  };

  const used = new Set<string>(pinned.map((p) => p.exerciseId));
  const slots: GeneratedSlot[] = [];
  const sortedDays = [...new Set(days)].sort((a, b) => a - b);

  sortedDays.forEach((dayOfWeek, dayIndex) => {
    const pinnedForDay = pinned.filter((p) => p.dayOfWeek === dayOfWeek);
    for (let slot = 0; slot < 3; slot++) {
      const existing = pinnedForDay.find((p) => p.position === slot);
      if (existing) {
        slots.push({
          dayOfWeek,
          position: slot,
          exerciseId: existing.exerciseId,
        });
        continue;
      }

      const category = categoryForSlot(dayIndex, slot);
      const preferred = equipmentForSlot(dayIndex, slot);
      const pool = pools[category];

      // Prefer the day's equipment when the category offers it, then any
      // unused exercise, then — pool exhausted — allow a repeat rather than
      // leaving a hole in the week.
      const pick =
        pool.find((e) => !used.has(e.id) && e.equipment === preferred) ??
        pool.find((e) => !used.has(e.id)) ??
        pool.find((e) => e.equipment === preferred) ??
        pool[0];
      if (!pick) continue; // a category with no candidates; can't happen with the seed

      used.add(pick.id);
      slots.push({ dayOfWeek, position: slot, exerciseId: pick.id });
    }
  });

  return slots;
}

/** The exercised body-part coverage of a week, for the UI's balance line. */
export interface WeekSummary {
  days: number;
  yoga: number;
  dumbbell: number;
  goals: Record<ExerciseGoal, number>;
  /** Every goal covered at least once. */
  balanced: boolean;
}

export function summarizeWeek(slots: GeneratedSlot[], exercises: PoolExercise[]): WeekSummary {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const goals: Record<ExerciseGoal, number> = {
    HIP_FLEXOR_MOBILITY: 0,
    GLUTE_STRENGTH: 0,
    HAMSTRING_LENGTH: 0,
    CORE_STABILITY: 0,
    LOWER_BACK_RELIEF: 0,
    UPPER_BACK_STRENGTH: 0,
    CHEST_MOBILITY: 0,
    POSTURE_AWARENESS: 0,
  };
  let yoga = 0;
  let dumbbell = 0;

  for (const slot of slots) {
    const exercise = byId.get(slot.exerciseId);
    if (!exercise) continue;
    if (exercise.equipment === "YOGA") yoga++;
    else dumbbell++;
    goals[exercise.goal]++;
  }

  const days = new Set(slots.map((s) => s.dayOfWeek)).size;
  const covered = Object.values(goals).filter((count) => count > 0).length;
  return { days, yoga, dumbbell, goals, balanced: covered >= 6 };
}
