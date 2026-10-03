/**
 * How an identity looks and grows — pure constants and arithmetic, safe on
 * both sides of the server boundary. The vote counts themselves come from
 * `lib/identity-votes.ts`.
 */

/**
 * The six identity hues, in the order they are assigned. The order is the
 * colour-blind safety mechanism: neighbours in a chart or a week never share a
 * confusable pair. Each name maps to `--id-<slot>` in globals.css, which holds
 * a light step and a dark step checked against every theme's surfaces.
 * Colour marks identity; text beside it always stays in text colours.
 */
export const IDENTITY_HUES = ["Teal", "Tangerine", "Purple", "Crimson", "Sky", "Mustard"] as const;
export const HUE_COUNT = IDENTITY_HUES.length;

/** At most one identity per hue, which is also plenty of selves to feed. */
export const MAX_IDENTITIES = HUE_COUNT;

export const clampSlot = (slot: number): number =>
  Number.isInteger(slot) && slot >= 1 && slot <= HUE_COUNT ? slot : 1;

/** The CSS colour for a slot, for `style={{ "--hue": hueVar(slot) }}`. */
export const hueVar = (slot: number): string => `var(--id-${clampSlot(slot)})`;

/** The first slot nobody holds, so a new identity never repeats a colour. */
export function nextFreeSlot(used: number[]): number {
  for (let slot = 1; slot <= HUE_COUNT; slot += 1) {
    if (!used.includes(slot)) return slot;
  }
  return 1;
}

/**
 * Jungian archetypes, in the twelve-figure form most people meet them in.
 * Prompts for reflection, not psychology: the card shows the line beside the
 * name so nobody has to know the theory.
 */
export const ARCHETYPES = {
  Sage: "Seeks understanding and trusts evidence.",
  Explorer: "Seeks the new and values freedom.",
  Hero: "Trains, protects and finds courage.",
  Creator: "Makes things that did not exist yet.",
  Ruler: "Brings order and takes responsibility.",
  Caregiver: "Looks after people.",
  Magician: "Changes how things work.",
  Lover: "Seeks closeness and beauty.",
  Jester: "Brings play and lightness.",
  Everyperson: "Belongs and keeps things real.",
  Innocent: "Hopes, and keeps things simple.",
  Rebel: "Questions the rules that don't serve.",
} as const;
export type Archetype = keyof typeof ARCHETYPES;
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES) as Archetype[];
export const isArchetype = (value: unknown): value is Archetype =>
  typeof value === "string" && value in ARCHETYPES;

/** The sigil set: lucide icon keys and the name a screen reader hears. */
export const SIGILS = {
  search: "Magnifier",
  palette: "Palette",
  landmark: "Columns",
  swords: "Swords",
  compass: "Compass",
  feather: "Feather",
  "heart-handshake": "Helping hands",
  mountain: "Mountain",
  lamp: "Lamp",
  laugh: "Smile",
  "book-open": "Book",
  sprout: "Sprout",
} as const;
export type Sigil = keyof typeof SIGILS;
export const SIGIL_NAMES = Object.keys(SIGILS) as Sigil[];
export const isSigil = (value: unknown): value is Sigil =>
  typeof value === "string" && value in SIGILS;

/** A sensible sigil for an archetype, so a quick identity still has a face. */
export const ARCHETYPE_SIGIL: Record<Archetype, Sigil> = {
  Sage: "search",
  Explorer: "compass",
  Hero: "swords",
  Creator: "palette",
  Ruler: "landmark",
  Caregiver: "heart-handshake",
  Magician: "lamp",
  Lover: "feather",
  Jester: "laugh",
  Everyperson: "book-open",
  Innocent: "sprout",
  Rebel: "mountain",
};

export const sigilFor = (sigil: string | null, archetype: string | null): Sigil =>
  isSigil(sigil) ? sigil : isArchetype(archetype) ? ARCHETYPE_SIGIL[archetype] : "sprout";

/**
 * Stages of becoming, by all-time votes. A Habitica level with a gentler
 * vocabulary: the names describe evidence, not rank. Votes never go down, so
 * a stage can't be lost.
 */
export const STAGES = [
  { min: 0, name: "Trying it on" },
  { min: 10, name: "Practising" },
  { min: 30, name: "Showing up" },
  { min: 60, name: "Dependable" },
  { min: 100, name: "Second nature" },
] as const;

export type Stage = {
  /** 1-based, for "Stage 3 of 5". */
  number: number;
  name: string;
  next: { name: string; votesToGo: number } | null;
  /** 0..100 through the current stage. 100 at the last stage. */
  progress: number;
};

export function stageFor(votes: number): Stage {
  let index = STAGES.length - 1;
  while (index > 0 && votes < STAGES[index].min) index -= 1;
  const current = STAGES[index];
  const next = STAGES[index + 1];
  return {
    number: index + 1,
    name: current.name,
    next: next ? { name: next.name, votesToGo: next.min - votes } : null,
    progress: next
      ? Math.round(((votes - current.min) / (next.min - current.min)) * 100)
      : 100,
  };
}

/** The display name: "Sherlock Holmes" reads as "Sherlock" in tight spots. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length > 1 && !/^(the|a|an)$/i.test(words[0]) ? words[0] : name;
}

/** Inverted laws for shadow patterns, Atomic Habits' breaking side. */
export const SHADOW_LAWS = [
  "Make it invisible",
  "Make it unattractive",
  "Make it difficult",
  "Make it unsatisfying",
] as const;
