/**
 * The moonlit garden on /mind: what grows, and at how many minutes.
 *
 * It's drawn from the total minutes ever sat, so it only grows: a missed
 * week takes nothing away, and a session ended early still adds what was
 * sat. The gaps between stages widen as they go, so early sittings bring
 * something new often and later ones still have somewhere to go.
 */

export type GardenStage = {
  id: string;
  name: string;
  /** Total minutes at which it appears. */
  minutes: number;
};

export const GARDEN_STAGES: readonly GardenStage[] = [
  { id: "meadow", name: "A moonlit meadow", minutes: 0 },
  { id: "flowers", name: "Wildflowers", minutes: 5 },
  { id: "pond", name: "A still pond", minutes: 15 },
  { id: "maple", name: "A young maple", minutes: 30 },
  { id: "lantern", name: "A stone lantern", minutes: 60 },
  { id: "fireflies", name: "Fireflies", minutes: 90 },
  { id: "path", name: "A stepping-stone path", minutes: 120 },
  { id: "willow", name: "A weeping willow", minutes: 180 },
  { id: "bridge", name: "A footbridge", minutes: 240 },
  { id: "koi", name: "Koi in the pond", minutes: 300 },
  { id: "lilies", name: "Water lilies", minutes: 360 },
  { id: "pavilion", name: "A pavilion on the hill", minutes: 420 },
  { id: "lantern-2", name: "A second lantern", minutes: 540 },
  { id: "cherry", name: "A cherry tree", minutes: 720 },
  { id: "moonpath", name: "Moonlight on the water", minutes: 900 },
  { id: "heron", name: "A night heron", minutes: 1200 },
  { id: "meteors", name: "Shooting stars", minutes: 1500 },
  { id: "full-moon", name: "The garden at full moon", minutes: 2000 },
];

/** Every stage reached at this many minutes, in order. */
export function stagesAt(totalMinutes: number): GardenStage[] {
  return GARDEN_STAGES.filter((stage) => stage.minutes <= Math.max(0, totalMinutes));
}

/** The next stage to come, or null once the garden is whole. */
export function nextStage(totalMinutes: number): GardenStage | null {
  return GARDEN_STAGES.find((stage) => stage.minutes > Math.max(0, totalMinutes)) ?? null;
}

/** What a sitting brought: stages reached after it that weren't before. */
export function unlockedBetween(before: number, after: number): GardenStage[] {
  return GARDEN_STAGES.filter((stage) => stage.minutes > before && stage.minutes <= after);
}

/** 0 to 1 from the last stage reached to the next one. */
export function towardNext(totalMinutes: number): number {
  const next = nextStage(totalMinutes);
  if (!next) return 1;
  const reached = stagesAt(totalMinutes);
  const from = reached.length ? reached[reached.length - 1].minutes : 0;
  return Math.min(1, Math.max(0, (totalMinutes - from) / (next.minutes - from)));
}
