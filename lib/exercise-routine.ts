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
 *   - every week covers all four corrective categories
 *   - every day carries at least one strength slot, and never the same
 *     category three times over
 *   - equipment balances near 50/50 across the week
 *   - pinned (user-swapped) slots are left untouched by regeneration
 *
 * Why quotas rather than a fixed per-slot template: the catalog is lopsided.
 * There are 8 mobility exercises but only ONE of them uses dumbbells, and
 * exactly 5 core exercises. The previous version derived both category and
 * equipment from the day index, so slot (day-index 1, position 2) demanded
 * "mobility + dumbbell" — a set of size one — and Dumbbell Pullover was
 * welded into every routine forever, while a 5-day week's five core slots
 * exhausted the core pool exactly. Neither could be shaken loose by any
 * amount of reseeding. Composition is now decided for the WEEK and only then
 * dealt out to days, so no slot is ever cornered into a single candidate.
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

/** The corrective jobs a workout day is made of. */
export type SlotCategory = "POSTERIOR" | "CORE" | "MOBILITY" | "UPPER";

const CATEGORIES: SlotCategory[] = ["POSTERIOR", "UPPER", "MOBILITY", "CORE"];

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

/**
 * How the week's slots are split between the four corrective jobs. Posterior
 * chain and upper back lead because they are the two things a desk actually
 * weakens; mobility and core support them.
 */
const CATEGORY_WEIGHT: Record<SlotCategory, number> = {
  POSTERIOR: 0.3,
  UPPER: 0.27,
  MOBILITY: 0.23,
  CORE: 0.2,
};

/** The load-bearing categories. Every day gets at least one. */
const STRENGTH: SlotCategory[] = ["POSTERIOR", "UPPER"];

/**
 * Order within a day: strength while you're fresh, mobility last as the
 * cooldown. Lower sorts earlier.
 */
const CATEGORY_RANK: Record<SlotCategory, number> = {
  POSTERIOR: 0,
  UPPER: 1,
  CORE: 2,
  MOBILITY: 3,
};

const SLOTS_PER_DAY = 3;

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

/**
 * How many slots each category gets across the whole week, by largest
 * remainder, clamped to what the catalog can actually supply.
 *
 * The clamp is the important half: a category can never be asked for more
 * exercises than exist, because that is what forces repeats and, worse,
 * corners the equipment choice down to a single candidate.
 */
function categoryQuotas(
  total: number,
  supply: Record<SlotCategory, number>,
): Record<SlotCategory, number> {
  const ceiling = (category: SlotCategory) =>
    Math.min(supply[category], total - (CATEGORIES.length - 1));

  const exact = CATEGORIES.map((category) => ({
    category,
    ideal: total * CATEGORY_WEIGHT[category],
  }));

  const quotas = {} as Record<SlotCategory, number>;
  for (const { category, ideal } of exact) {
    quotas[category] = Math.min(Math.max(1, Math.floor(ideal)), ceiling(category));
  }

  // Hand out what's left to whoever was cut shortest of its ideal share and
  // still has room, so the rounding error lands where it hurts least.
  let assigned = CATEGORIES.reduce((sum, c) => sum + quotas[c], 0);
  while (assigned < total) {
    const candidates = exact
      .filter(({ category }) => quotas[category] < ceiling(category))
      .sort(
        (a, b) =>
          b.ideal - quotas[b.category] - (a.ideal - quotas[a.category]),
      );
    if (candidates.length === 0) break; // catalog too small; caller gets repeats
    quotas[candidates[0].category] += 1;
    assigned += 1;
  }

  // Over-assigned (possible when every ceiling is generous and floors round
  // up): take back from whoever is furthest above its ideal share.
  while (assigned > total) {
    const candidates = exact
      .filter(({ category }) => quotas[category] > 1)
      .sort(
        (a, b) =>
          quotas[b.category] - b.ideal - (quotas[a.category] - a.ideal),
      );
    if (candidates.length === 0) break;
    quotas[candidates[0].category] -= 1;
    assigned -= 1;
  }

  return quotas;
}

/**
 * Deal a shuffled multiset of categories across the days, then repair it so
 * no day triples up on one category and every day gets a strength slot.
 *
 * Dealing round-robin (every day's first slot, then every day's second) is
 * what spreads categories in the first place; the repair pass only has to
 * clean up the tail of an unlucky shuffle.
 */
function dealCategories(
  quotas: Record<SlotCategory, number>,
  dayCount: number,
  openings: number[],
  random: () => number,
): SlotCategory[][] {
  const bag: SlotCategory[] = [];
  for (const category of CATEGORIES) {
    for (let i = 0; i < quotas[category]; i++) bag.push(category);
  }
  const deck = shuffle(bag, random);

  const days: SlotCategory[][] = Array.from({ length: dayCount }, () => []);
  let cursor = 0;
  for (let round = 0; round < SLOTS_PER_DAY; round++) {
    for (let day = 0; day < dayCount; day++) {
      if (days[day].length >= openings[day]) continue;
      if (cursor >= deck.length) break;
      days[day].push(deck[cursor++]);
    }
  }
  // Anything the round-robin couldn't place (days fill unevenly once pins
  // take positions) goes wherever there is still room.
  for (let day = 0; day < dayCount && cursor < deck.length; day++) {
    while (days[day].length < openings[day] && cursor < deck.length) {
      days[day].push(deck[cursor++]);
    }
  }

  const tripled = (list: SlotCategory[]) =>
    list.find((c) => list.filter((other) => other === c).length >= 3);
  const needsStrength = (list: SlotCategory[], opening: number) =>
    opening === SLOTS_PER_DAY && !list.some((c) => STRENGTH.includes(c));

  // Swap offending entries with a compatible one on another day. Bounded by
  // the slot count — a couple of passes is always enough in practice, and a
  // hard bound means a pathological catalog can't spin here.
  for (let pass = 0; pass < deck.length; pass++) {
    let repaired = false;

    for (let day = 0; day < dayCount; day++) {
      const excess = tripled(days[day]);
      if (excess === undefined) continue;
      const donor = days.findIndex(
        (other, index) =>
          index !== day &&
          !other.includes(excess) &&
          other.some((c) => days[day].filter((x) => x === c).length === 0),
      );
      if (donor === -1) continue;
      const give = days[day].indexOf(excess);
      const take = days[donor].findIndex(
        (c) => !days[day].includes(c) || c !== excess,
      );
      [days[day][give], days[donor][take]] = [days[donor][take], days[day][give]];
      repaired = true;
    }

    for (let day = 0; day < dayCount; day++) {
      if (!needsStrength(days[day], openings[day])) continue;
      const donor = days.findIndex(
        (other, index) =>
          index !== day &&
          other.filter((c) => STRENGTH.includes(c)).length > 1,
      );
      if (donor === -1) continue;
      const take = days[donor].findIndex((c) => STRENGTH.includes(c));
      const give = days[day].findIndex((c) => !days[donor].includes(c));
      const giveIndex = give === -1 ? 0 : give;
      [days[day][giveIndex], days[donor][take]] = [
        days[donor][take],
        days[day][giveIndex],
      ];
      repaired = true;
    }

    if (!repaired) break;
  }

  return days;
}

/** One slot after composition, before an exercise is chosen for it. */
interface OpenSlot {
  dayOfWeek: number;
  dayIndex: number;
  category: SlotCategory;
  equipment: ExerciseEquipment | null;
}

export interface GenerateOptions {
  /** 0 = Sunday .. 6 = Saturday. Any length 1..7; the builder offers 3-5. */
  days: number[];
  /** The active catalog. */
  exercises: PoolExercise[];
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

/**
 * Build a week: for each day, three non-repeating exercises drawn from the
 * corrective categories, balanced across equipment.
 */
export function generateRoutine({
  days,
  exercises,
  variant = 0,
  pinned = [],
  avoid = [],
}: GenerateOptions): GeneratedSlot[] {
  const random = mulberry32(variant + 1);
  const sortedDays = [...new Set(days)].sort((a, b) => a - b);
  if (sortedDays.length === 0) return [];

  const pools = {} as Record<SlotCategory, PoolExercise[]>;
  for (const category of CATEGORIES) {
    pools[category] = exercises.filter(
      (e) => CATEGORY_OF_GOAL[e.goal] === category,
    );
  }

  // Pinned slots hold their exact place; composition only fills what's left.
  const pinnedByDay = new Map<number, PinnedSlot[]>();
  for (const slot of pinned) {
    if (!sortedDays.includes(slot.dayOfWeek)) continue;
    if (slot.position < 0 || slot.position >= SLOTS_PER_DAY) continue;
    pinnedByDay.set(slot.dayOfWeek, [
      ...(pinnedByDay.get(slot.dayOfWeek) ?? []),
      slot,
    ]);
  }

  const openings = sortedDays.map(
    (day) => SLOTS_PER_DAY - (pinnedByDay.get(day)?.length ?? 0),
  );
  const total = openings.reduce((sum, n) => sum + n, 0);

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
  if (total === 0) return slots.sort(byDayThenPosition);

  const supply = {} as Record<SlotCategory, number>;
  for (const category of CATEGORIES) supply[category] = pools[category].length;

  const quotas = categoryQuotas(total, supply);
  const dealt = dealCategories(quotas, sortedDays.length, openings, random);

  const open: OpenSlot[] = [];
  sortedDays.forEach((dayOfWeek, dayIndex) => {
    for (const category of dealt[dayIndex]) {
      open.push({ dayOfWeek, dayIndex, category, equipment: null });
    }
  });

  // --- equipment, as a week-level target rather than a per-slot mandate.
  //
  // Decided per category against what that category can actually supply,
  // never slot-by-slot. A greedy "give this slot whichever side is behind on
  // quota" rule looks reasonable and is quietly fatal: it strictly
  // alternates, so a fixed slot in the sequence always lands on the same
  // side, and for mobility — which offers exactly one dumbbell exercise —
  // that means Dumbbell Pullover in every week forever. Allocating per
  // category instead lets mobility take the yoga side it can genuinely fill
  // and the roomy categories absorb the balance.
  const yogaByCategory = {} as Record<SlotCategory, number>;
  const floorOf = {} as Record<SlotCategory, number>;
  const capOf = {} as Record<SlotCategory, number>;
  for (const category of CATEGORIES) {
    const yogaCount = pools[category].filter((e) => e.equipment === "YOGA").length;
    const dumbbellCount = pools[category].length - yogaCount;
    floorOf[category] = Math.max(0, quotas[category] - dumbbellCount);
    capOf[category] = Math.max(
      floorOf[category],
      Math.min(quotas[category], yogaCount),
    );
    yogaByCategory[category] = floorOf[category];
  }

  const yogaTarget = Math.round(total / 2);
  let yogaAssigned = CATEGORIES.reduce((sum, c) => sum + yogaByCategory[c], 0);
  while (yogaAssigned !== yogaTarget) {
    const up = yogaAssigned < yogaTarget;
    const room = CATEGORIES.filter((c) =>
      up ? yogaByCategory[c] < capOf[c] : yogaByCategory[c] > floorOf[c],
    );
    if (room.length === 0) break; // catalog can't reach 50/50; get as close as it allows
    yogaByCategory[room[Math.floor(random() * room.length)]] += up ? 1 : -1;
    yogaAssigned += up ? 1 : -1;
  }

  for (const category of CATEGORIES) {
    const inCategory = shuffle(
      open.filter((slot) => slot.category === category),
      random,
    );
    inCategory.forEach((slot, index) => {
      slot.equipment = index < yogaByCategory[category] ? "YOGA" : "DUMBBELL";
    });
  }

  // Scarcest categories pick their exercises first, so a tight pool isn't
  // left holding whatever the roomy ones didn't want.
  const scarcity = (category: SlotCategory) => {
    const pool = pools[category];
    return Math.min(
      pool.filter((e) => e.equipment === "YOGA").length,
      pool.filter((e) => e.equipment === "DUMBBELL").length,
    );
  };
  const order = shuffle(open, random).sort(
    (a, b) => scarcity(a.category) - scarcity(b.category),
  );

  // --- pick the exercises.
  //
  // Scored rather than "first match wins", so several soft preferences can
  // compete: the equipment this slot was allotted, a goal the week hasn't
  // covered yet, and something the outgoing routine wasn't using. The jitter
  // is what keeps two runs of the same variant apart from each other in feel
  // without ever making the variant itself non-reproducible.
  const used = new Set<string>(pinned.map((p) => p.exerciseId));
  const stale = new Set(avoid);
  const seenGoals = new Set<ExerciseGoal>();
  const picked: Array<{ slot: OpenSlot; exercise: PoolExercise }> = [];

  for (const slot of order) {
    const pool = pools[slot.category];
    if (pool.length === 0) continue;

    const fresh = pool.filter((e) => !used.has(e.id));
    // Relax only when the pool is genuinely spent, so a hole is never left
    // in the week.
    const candidates = fresh.length > 0 ? fresh : pool;

    let best: PoolExercise | null = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score =
        (candidate.equipment === slot.equipment ? 3 : 0) +
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
    for (let position = 0; position < SLOTS_PER_DAY; position++) {
      if (!taken.has(position)) free.push(position);
    }

    const picks = picked
      .filter((entry) => entry.slot.dayOfWeek === dayOfWeek)
      .sort(
        (a, b) =>
          CATEGORY_RANK[a.slot.category] - CATEGORY_RANK[b.slot.category],
      );

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
