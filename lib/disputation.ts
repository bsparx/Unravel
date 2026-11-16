/**
 * ABCDE disputation, after Martin Seligman's *Learned Optimism*.
 *
 * A setback (Adversity) sets off an automatic Belief, which drives the
 * Consequences — what you felt and did. Disputing the belief, the way you'd
 * argue with someone else who said it about you, is what changes the
 * Energization that follows.
 *
 * Client-safe (no Prisma): the ritual, the cards and the server schema all
 * read the same copy and the same clamps.
 */

export type DisputeLens = "evidence" | "alternatives" | "implications" | "usefulness";

export type DisputationFields = {
  adversity: string;
  belief: string;
  beliefBefore: number | null;
  consequences: string;
  evidence: string;
  alternatives: string;
  implications: string;
  usefulness: string;
  energization: string;
  beliefAfter: number | null;
};

export type DisputationCard = DisputationFields & {
  id: string;
  createdAt: string;
  /** "16 Nov", in the user's timezone. */
  createdLabel: string;
};

export type AbcdeKey = "adversity" | "belief" | "consequences" | "disputation" | "energization";

export type AbcdeStep = {
  key: AbcdeKey;
  letter: string;
  name: string;
  question: string;
  guide: string;
  placeholder: string;
};

export const ABCDE_STEPS: readonly AbcdeStep[] = [
  {
    key: "adversity",
    letter: "A",
    name: "Adversity",
    question: "What happened?",
    guide: "Just the facts, as a camera would have seen them. Save the meaning for the next step.",
    placeholder: "My message to the team got no replies all afternoon",
  },
  {
    key: "belief",
    letter: "B",
    name: "Belief",
    question: "What did you tell yourself about it?",
    guide: "The thought that arrived on its own, in its own words. Don't tidy it up.",
    placeholder: "They think my idea is stupid and I shouldn't have said anything",
  },
  {
    key: "consequences",
    letter: "C",
    name: "Consequences",
    question: "What did that belief make you feel and do?",
    guide: "The feelings, and what you did or didn't do because of them.",
    placeholder: "Felt my face go hot, stopped working on it, scrolled for an hour",
  },
  {
    key: "disputation",
    letter: "D",
    name: "Disputation",
    question: "Now argue back.",
    guide: "As if a rival had said it about you. Use whichever lenses help; one is enough.",
    placeholder: "",
  },
  {
    key: "energization",
    letter: "E",
    name: "Energization",
    question: "How do you feel, and what will you do now?",
    guide: "What shifted once the belief was answered.",
    placeholder: "Calmer. I'll ask Sana directly what she thinks tomorrow morning",
  },
] as const;

/** Seligman's four ways to argue with a belief. */
export const DISPUTE_LENSES: readonly {
  key: DisputeLens;
  name: string;
  question: string;
  placeholder: string;
}[] = [
  {
    key: "evidence",
    name: "Evidence",
    question: "What actually supports or contradicts it?",
    placeholder: "Two people reacted with a thumbs-up. It was a Friday afternoon.",
  },
  {
    key: "alternatives",
    name: "Alternatives",
    question: "What else could explain it?",
    placeholder: "They're busy, or still thinking about it.",
  },
  {
    key: "implications",
    name: "Implications",
    question: "Even if it's true, what does it really mean?",
    placeholder: "One idea landing flat doesn't mean the next one will.",
  },
  {
    key: "usefulness",
    name: "Usefulness",
    question: "Does holding this belief help you right now?",
    placeholder: "No. It just stops me from following up.",
  },
] as const;

export const DISPUTATION_MAX = {
  adversity: 300,
  belief: 300,
  consequences: 400,
  lens: 500,
  energization: 400,
} as const;

export const EMPTY_DISPUTATION: DisputationFields = {
  adversity: "",
  belief: "",
  beliefBefore: null,
  consequences: "",
  evidence: "",
  alternatives: "",
  implications: "",
  usefulness: "",
  energization: "",
  beliefAfter: null,
};

/** At least one lens has something real in it. */
export function hasDispute(fields: Pick<DisputationFields, DisputeLens>): boolean {
  return DISPUTE_LENSES.some((lens) => fields[lens.key].trim().length > 0);
}

/** "8 → 3": the change in conviction, or null when either side is missing. */
export function beliefShift(
  fields: Pick<DisputationFields, "beliefBefore" | "beliefAfter">,
): number | null {
  if (fields.beliefBefore === null || fields.beliefAfter === null) return null;
  return fields.beliefAfter - fields.beliefBefore;
}
