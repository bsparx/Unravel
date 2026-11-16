/**
 * WOOP — Wish, Outcome, Obstacle, Plan. Gabriele Oettingen's mental
 * contrasting with implementation intentions: name what you want, picture
 * the best of having it, then picture what *in you* stands in the way, and
 * bind that obstacle to an if-then plan.
 *
 * Client-safe on purpose (no Prisma): the ritual dialog, the cards and the
 * server schema all read the same step copy and the same clamps.
 */

export type WoopKey = "wish" | "outcome" | "obstacle" | "plan";

export type WoopFields = Record<WoopKey, string>;

/** A wish as the board renders it. */
export type WishCard = WoopFields & {
  id: string;
  status: "ACTIVE" | "ACHIEVED" | "RELEASED";
  /** ISO timestamp of when it was achieved or let go. */
  settledAt: string | null;
  createdAt: string;
  /** "16 Nov", in the user's timezone. */
  createdLabel: string;
  settledLabel: string | null;
};

export type WoopStep = {
  key: WoopKey;
  letter: string;
  name: string;
  /** The question, in the display serif. */
  question: string;
  /** One line of the method — what makes an answer a good one. */
  guide: string;
  placeholder: string;
  max: number;
  /** Pause to picture it before moving on: mental contrasting is imagery. */
  picture?: string;
};

export const WOOP_STEPS: readonly WoopStep[] = [
  {
    key: "wish",
    letter: "W",
    name: "Wish",
    question: "What do you want from this, today?",
    guide: "Challenging, but within reach. A few words is enough.",
    placeholder: "Finish the chapter draft",
    max: 120,
  },
  {
    key: "outcome",
    letter: "O",
    name: "Outcome",
    question: "What's the best thing about getting there?",
    guide: "Not the wish again. How will it feel once it's done?",
    placeholder: "The weight off my chest, and an evening that's actually free",
    max: 240,
    picture: "Close your eyes. Let the best outcome play for a moment.",
  },
  {
    key: "obstacle",
    letter: "O",
    name: "Obstacle",
    question: "What in you is most likely to get in the way?",
    guide: "Something inside you, not the world: a habit, a feeling, an excuse.",
    placeholder: "Reaching for my phone the moment it gets hard",
    max: 240,
    picture: "Now picture that moment, the one where it usually slips.",
  },
  {
    key: "plan",
    letter: "P",
    name: "Plan",
    question: "When it shows up, what will you do?",
    guide: "One concrete action. It finishes the sentence below.",
    placeholder: "put the phone in the other room and write one more line",
    max: 240,
  },
] as const;

export const EMPTY_WOOP: WoopFields = {
  wish: "",
  outcome: "",
  obstacle: "",
  plan: "",
};

export const WOOP_MAX: Record<WoopKey, number> = Object.fromEntries(
  WOOP_STEPS.map((step) => [step.key, step.max]),
) as Record<WoopKey, number>;

/** Lowercase the first letter, so a clause reads mid-sentence. */
export function woopClause(text: string): string {
  const trimmed = text.trim().replace(/[.!\s]+$/, "");
  if (!trimmed) return trimmed;
  // Leave "I" and acronyms alone; only soften an ordinary capital.
  if (/^I\b/.test(trimmed) || /^[A-Z]{2}/.test(trimmed)) return trimmed;
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

/** "If <obstacle>, then I will <plan>." — the implementation intention. */
export function formatIfThen(woop: Pick<WoopFields, "obstacle" | "plan">): string {
  return `If ${woopClause(woop.obstacle)}, then I will ${woopClause(woop.plan)}.`;
}

/** Both halves present and inside their clamps. */
export function isWoopComplete(woop: WoopFields): boolean {
  return WOOP_STEPS.every((step) => {
    const value = woop[step.key].trim();
    return value.length > 0 && value.length <= step.max;
  });
}
