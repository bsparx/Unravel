import type { IdentityKind } from "@/lib/generated/prisma/client";
import type { Sigil } from "@/lib/identity-look";
import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import type { VoteTally } from "@/lib/vote-tally";

/**
 * One identity as the board shows it: the 30-day reinforcement analytics, plus
 * the character profile and the all-time vote tally.
 */
export type BoardIdentity = IdentityReinforcement & {
  short: string;
  kind: IdentityKind | null;
  archetype: string | null;
  question: string | null;
  colorSlot: number;
  sigil: Sigil;
  tally: VoteTally;
};
