/**
 * Routine generation — pure functions. No React, no Prisma.
 *
 * The corrective logic the whole feature is built on: anterior pelvic tilt
 * (lower cross) is fixed by strengthening glutes + deep core and stretching
 * hip flexors; rounded shoulders (upper cross) by strengthening the upper
 * back and opening the chest. Every exercise now carries a `type` —
 * STRENGTH, MOBILITY or FLOW — and days are composed from those types, not
 * from body-part tags, because tags alone cannot tell a stretch from a hold.
 *
 * A week is periodized into day types:
 *   - STANDARD: strength leads, mobility closes. One slot => one strength
 *     move; two => one of each; three => two strength + one mobility (and
 *     the table continues up to five).
 *   - FLOW: a single continuous FLOW exercise — the aerobic day.
 *   - RECOVERY: all mobility — the day the rest of the week rests on.
 * The person names each day's type in the builder, or takes the auto
 * pattern: first training day RECOVERY, last FLOW, the rest STANDARD.
 *
 * Structural rules:
 *   - a workout day has 1..5 slots (positions 0..4) — the per-day cap lives
 *     here AND in the schema; the builder lets every day carry its own count
 *   - no exercise repeats across the week while the pool allows it
 *   - equipment balances near 50/50 across the week
 *   - pinned (user-swapped) slots are left untouched by regeneration
 */

export type ExerciseEquipment = "YOGA" | "DUMBBELL";

export type ExerciseType = "STRENGTH" | "MOBILITY" | "FLOW";

export type RoutineDayType = "STANDARD" | "FLOW" | "RECOVERY";

export type ExerciseGoal =
  | "HIP_FLEXOR_MOBILITY"
  | "GLUTE_STRENGTH"
  | "HAMSTRING_LENGTH"
  | "CORE_STABILITY"
  | "LOWER_BACK_RELIEF"
  | "UPPER_BACK_STRENGTH"
  | "CHEST_MOBILITY"
  | "POSTURE_AWARENESS"
  | "NECK_MOBILITY"
  | "NECK_STRENGTH"
  | "CALF_MOBILITY"
  | "WRIST_MOBILITY"
  | "LEG_STRENGTH"
  | "PUSH_STRENGTH"
  | "BALANCE"
  | "CARDIO"
  | "HIP_MOBILITY"
  | "ANKLE_MOBILITY"
  | "CALF_STRENGTH";

/** What the generator actually needs from an exercise. */
export interface PoolExercise {
  id: string;
  equipment: ExerciseEquipment;
  goal: ExerciseGoal;
  type: ExerciseType;
}

/** One slot of the week being produced. `position` is 0..4 within the day. */
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

/** The day kinds the builder offers, in their picker order. */
export const ROUTINE_DAY_TYPES: RoutineDayType[] = [
  "STANDARD",
  "FLOW",
  "RECOVERY",
];

/**
 * The auto periodization pattern: the first training day is the recovery
 * day, the last is the flow day, everything between is standard work. Weeks
 * of six or more days earn a second flow day, since "one or two flow days"
 * is the classic aerobic dose.
 */
export function autoDayTypes(days: number[]): RoutineDayType[] {
  const count = days.length;
  const types: RoutineDayType[] = days.map(() => "STANDARD");
  if (count >= 2) types[count - 1] = "FLOW";
  if (count >= 3) types[0] = "RECOVERY";
  if (count >= 6) types[count - 2] = "FLOW";
  return types;
}

/**
 * How a STANDARD day's slots split between strength and mobility, by the
 * day's total. Strength always leads, mobility always closes, and a day
 * never becomes all of one thing: the three-slot default is the canonical
 * two-plus-one.
 */
const STANDARD_MIX: Record<number, [number, number]> = {
  1: [1, 0],
  2: [1, 1],
  3: [2, 1],
  4: [2, 2],
  5: [3, 2],
};

/** Order within a day: strength while fresh, mobility as the cooldown. */
const TYPE_RANK: Record<ExerciseType, number> = {
  STRENGTH: 0,
  MOBILITY: 1,
  FLOW: 2,
};

/** Hard cap on any single day's slots; mirrored by validation. */
const MAX_SLOTS_PER_DAY = 5;

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
  /** 0 = Sunday .. 6 = Saturday. Any length 1..7; the builder offers all of them. */
  days: number[];
  /**
   * How many slots each entry of `days` carries, index-aligned. Each 1..5.
   * Defaults to 3 per day, which keeps the canonical shape. FLOW days are
   * always exactly one slot — the flow itself.
   */
  counts?: number[];
  /**
   * What each day is for, index-aligned with `days`. Omitted => the auto
   * pattern (first RECOVERY, last FLOW, rest STANDARD).
   */
  dayTypes?: RoutineDayType[];
  /** The active catalog. */
  exercises: PoolExercise[];
  /**
   * Which catalog the week may draw from. "YOGA" and "DUMBBELL" filter the
   * pool to that side before composition — the week is that equipment, not
   * balanced against the other. Null (the default) mixes both near 50/50.
   */
  equipment?: ExerciseEquipment | null;
  /** 0 = the canonical routine; higher variants reshuffle the week. */
  variant?: number;
  /** User-swapped slots: regenerated around, never over. */
  pinned?: PinnedSlot[];
  /**
   * Exercise ids in the routine being replaced. Not forbidden — the pools are
   * too small for that — but pushed down the ranking, so successive
   * regenerations sweep the catalog instead of orbiting the same ten.
   */
  avoid?: string[];
}

/** One slot after composition, before an exercise is chosen for it. */
interface OpenSlot {
  dayOfWeek: number;
  type: ExerciseType;
  equipment: ExerciseEquipment | null;
}

/**
 * Build a week: for each day, the mix its type calls for, drawn from the
 * catalog with no repeats while the pool allows, balanced across equipment.
 */
export function generateRoutine({
  days,
  counts,
  dayTypes,
  exercises: allExercises,
  equipment = null,
  variant = 0,
  pinned = [],
  avoid = [],
}: GenerateOptions): GeneratedSlot[] {
  // The preference is a pool filter, not a second balancing rule: with only
  // one equipment in the pool, every supply-derived floor and cap below
  // collapses onto it, and the 50/50 pass finds no room to move. Scarcity
  // still clamps (a dumbbell-only week has exactly one mobility exercise to
  // draw from), and repeats stay allowed once a pool is genuinely spent.
  const exercises = equipment
    ? allExercises.filter((e) => e.equipment === equipment)
    : allExercises;

  const random = mulberry32(variant + 1);
  const countByDay = new Map<number, number>();
  days.forEach((day, index) => {
    if (!countByDay.has(day)) countByDay.set(day, counts?.[index] ?? 3);
  });
  const sortedDays = [...countByDay.keys()].sort((a, b) => a - b);
  if (sortedDays.length === 0) return [];
  const countOf = (day: number) => countByDay.get(day) ?? 3;

  // The auto pattern fills in any day the person didn't name.
  const dayTypeOf = (day: number, index: number): RoutineDayType => {
    if (dayTypes) return dayTypes[index] ?? "STANDARD";
    return autoDayTypes(sortedDays)[index];
  };

  const pools = {} as Record<ExerciseType, PoolExercise[]>;
  for (const type of Object.keys(TYPE_RANK) as ExerciseType[]) {
    pools[type] = exercises.filter((e) => e.type === type);
  }

  // Pinned slots hold their exact place; composition only fills what's left.
  const pinnedByDay = new Map<number, PinnedSlot[]>();
  for (const slot of pinned) {
    if (!sortedDays.includes(slot.dayOfWeek)) continue;
    if (slot.position < 0 || slot.position >= MAX_SLOTS_PER_DAY) continue;
    pinnedByDay.set(slot.dayOfWeek, [
      ...(pinnedByDay.get(slot.dayOfWeek) ?? []),
      slot,
    ]);
  }

  const slots: GeneratedSlot[] = [];
  for (const list of pinnedByDay.values()) {
    for (const slot of list) {
      slots.push({
        dayOfWeek: slot.dayOfWeek,
        position: slot.position,
        exerciseId: slot.exerciseId,
      });
    }
  }

  // --- per-day plans: how many open slots each day has, and what types.
  //
  // A FLOW day is exactly one slot — the flow. A RECOVERY day is all
  // mobility. A STANDARD day reads its mix from the table and then deducts
  // whatever the person's pinned picks already supply, so a pinned
  // mobility move shrinks the mobility demand rather than being replaced.
  const open: OpenSlot[] = [];
  sortedDays.forEach((day, dayIndex) => {
    const dayType = dayTypeOf(day, dayIndex);
    const pinnedSlots = pinnedByDay.get(day) ?? [];
    const total = dayType === "FLOW" ? 1 : countOf(day);
    const openings = Math.max(0, total - pinnedSlots.length);
    if (openings === 0) return;

    if (dayType === "FLOW") {
      // The flow pool can be empty under a dumbbells-only preference —
      // degrade to a standard day rather than leave a hole in the week.
      const kind: ExerciseType =
        pools.FLOW.length > 0
          ? "FLOW"
          : STANDARD_MIX[openings][0] > 0
            ? "STRENGTH"
            : "MOBILITY";
      open.push({ dayOfWeek: day, type: kind, equipment: null });
      return;
    }

    const types: ExerciseType[] = [];
    if (dayType === "RECOVERY") {
      for (let i = 0; i < openings; i++) types.push("MOBILITY");
    } else {
      const [strength, mobility] = STANDARD_MIX[openings] ?? [0, 0];
      const pinnedStrength = pinnedSlots.filter(
        (slot) =>
          exercises.find((e) => e.id === slot.exerciseId)?.type === "STRENGTH",
      ).length;
      const pinnedMobility = pinnedSlots.filter(
        (slot) =>
          exercises.find((e) => e.id === slot.exerciseId)?.type !== "STRENGTH",
      ).length;
      for (let i = 0; i < Math.max(0, strength - pinnedStrength); i++) {
        types.push("STRENGTH");
      }
      for (let i = 0; i < Math.max(0, mobility - pinnedMobility); i++) {
        types.push("MOBILITY");
      }
      // A day whose pins are all strength and whose table wants all mobility
      // (or vice versa) could end up shorter than its count — fill from the
      // strength side, which is never a bad place for a spare slot to land.
      while (types.length < openings) types.push("STRENGTH");
    }
    for (const type of types) {
      open.push({ dayOfWeek: day, type, equipment: null });
    }
  });

  // --- equipment, as a week-level target rather than a per-slot mandate.
  //
  // Decided per type against what that type can actually supply, never
  // slot-by-slot. A greedy "give this slot whichever side is behind on
  // quota" rule looks reasonable and is quietly fatal: it strictly
  // alternates, so a fixed slot in the sequence always lands on the same
  // side, and for mobility — which offers exactly one dumbbell exercise —
  // that means Dumbbell Pullover in every week forever. Allocating per type
  // instead lets mobility take the yoga side it can genuinely fill and the
  // roomy types absorb the balance.
  const total = open.length;
  const types = ["STRENGTH", "MOBILITY", "FLOW"] as ExerciseType[];
  const yogaByType = {} as Record<ExerciseType, number>;
  const floorOf = {} as Record<ExerciseType, number>;
  const capOf = {} as Record<ExerciseType, number>;
  for (const type of types) {
    const yogaCount = pools[type].filter((e) => e.equipment === "YOGA").length;
    const dumbbellCount = pools[type].length - yogaCount;
    const wanted = open.filter((slot) => slot.type === type).length;
    floorOf[type] = Math.max(0, wanted - dumbbellCount);
    capOf[type] = Math.max(floorOf[type], Math.min(wanted, yogaCount));
    yogaByType[type] = floorOf[type];
  }

  const yogaTarget = Math.round(total / 2);
  let yogaAssigned = types.reduce((sum, t) => sum + yogaByType[t], 0);
  while (yogaAssigned !== yogaTarget) {
    const up = yogaAssigned < yogaTarget;
    const room = types.filter((t) =>
      up ? yogaByType[t] < capOf[t] : yogaByType[t] > floorOf[t],
    );
    if (room.length === 0) break; // catalog can't reach 50/50; get as close as it allows
    yogaByType[room[Math.floor(random() * room.length)]] += up ? 1 : -1;
    yogaAssigned += up ? 1 : -1;
  }

  for (const type of types) {
    const inType = shuffle(
      open.filter((slot) => slot.type === type),
      random,
    );
    inType.forEach((slot, index) => {
      slot.equipment = index < yogaByType[type] ? "YOGA" : "DUMBBELL";
    });
  }

  // Scarcest types pick their exercises first, so a tight pool isn't left
  // holding whatever the roomy ones didn't want.
  const scarcity = (type: ExerciseType) => {
    const pool = pools[type];
    return Math.min(
      pool.filter((e) => e.equipment === "YOGA").length,
      pool.filter((e) => e.equipment === "DUMBBELL").length,
    );
  };
  const order = shuffle(open, random).sort(
    (a, b) => scarcity(a.type) - scarcity(b.type),
  );

  // --- pick the exercises.
  //
  // Scored rather than "first match wins", so several soft preferences can
  // compete: a goal the week hasn't covered yet, and something the outgoing
  // routine wasn't using. The equipment, though, is not soft — the slot was
  // allotted a side by the balance pass, and honoring it is what makes that
  // pass mean anything. The other side only gets drawn on when the allotted
  // side is genuinely spent, and the whole type pool only when the type is.
  // The jitter is what keeps two runs of the same variant apart from each
  // other in feel without ever making the variant itself non-reproducible.
  const used = new Set<string>(pinned.map((p) => p.exerciseId));
  const stale = new Set(avoid);
  const seenGoals = new Set<ExerciseGoal>();
  const picked: Array<{ slot: OpenSlot; exercise: PoolExercise }> = [];

  for (const slot of order) {
    const pool = pools[slot.type];
    if (pool.length === 0) continue;

    const allotted = pool.filter((e) => e.equipment === slot.equipment);
    const fresh = allotted.filter((e) => !used.has(e.id));
    // Relax step by step, so a hole is never left in the week: the allotted
    // side first, then the whole type, then (only when the week is huge and
    // the type is genuinely exhausted) repeats.
    const candidates =
      fresh.length > 0
        ? fresh
        : allotted.length > 0
          ? allotted
          : pool.filter((e) => !used.has(e.id)).length > 0
            ? pool.filter((e) => !used.has(e.id))
            : pool;

    let best: PoolExercise | null = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score =
        (seenGoals.has(candidate.goal) ? 0 : 2.5) +
        (stale.has(candidate.id) ? 0 : 2) +
        random() * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) continue;

    used.add(best.id);
    seenGoals.add(best.goal);
    picked.push({ slot, exercise: best });
  }

  // --- lay them out: strength first, mobility last, into the open positions.
  sortedDays.forEach((dayOfWeek) => {
    const taken = new Set(
      (pinnedByDay.get(dayOfWeek) ?? []).map((p) => p.position),
    );
    const free: number[] = [];
    for (let position = 0; position < countOf(dayOfWeek); position++) {
      if (!taken.has(position)) free.push(position);
    }

    const picks = picked
      .filter((entry) => entry.slot.dayOfWeek === dayOfWeek)
      .sort((a, b) => TYPE_RANK[a.slot.type] - TYPE_RANK[b.slot.type]);

    picks.forEach((entry, index) => {
      const position = free[index];
      if (position === undefined) return;
      slots.push({ dayOfWeek, position, exerciseId: entry.exercise.id });
    });
  });

  return slots.sort(byDayThenPosition);
}

function byDayThenPosition(a: GeneratedSlot, b: GeneratedSlot): number {
  return a.dayOfWeek - b.dayOfWeek || a.position - b.position;
}

/** The exercised body-part coverage of a week, for the UI's balance line. */
export interface WeekSummary {
  days: number;
  yoga: number;
  dumbbell: number;
  goals: Record<ExerciseGoal, number>;
  /** Most goals covered at least once (a solid majority of the catalog). */
  balanced: boolean;
}

export function summarizeWeek(
  slots: GeneratedSlot[],
  exercises: PoolExercise[],
): WeekSummary {
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
    NECK_MOBILITY: 0,
    NECK_STRENGTH: 0,
    CALF_MOBILITY: 0,
    WRIST_MOBILITY: 0,
    LEG_STRENGTH: 0,
    PUSH_STRENGTH: 0,
    BALANCE: 0,
    CARDIO: 0,
    HIP_MOBILITY: 0,
    ANKLE_MOBILITY: 0,
    CALF_STRENGTH: 0,
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
  // Six of nineteen goals is what a typed 3-day week (recovery + standard +
  // flow) genuinely covers; longer weeks cover more.
  return { days, yoga, dumbbell, goals, balanced: covered >= 6 };
}
