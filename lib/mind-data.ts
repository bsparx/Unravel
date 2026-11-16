import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { DisputationCard } from "@/lib/disputation";
import type { WishCard } from "@/lib/woop";

export type MindView = {
  active: WishCard[];
  settled: WishCard[];
  disputations: DisputationCard[];
};

/**
 * Everything /mind shows, in one round trip. Dates cross to the client as
 * ISO strings: the board is a client island and a Date would arrive as a
 * string anyway, just without saying so in the type.
 */
export async function getMind(user: User): Promise<MindView> {
  // Formatted here, in the user's own zone, so a note written at 23:50 is
  // filed under the day it was written and server and client agree.
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: user.timezone,
  });

  const [wishes, disputations] = await Promise.all([
    prisma.wish.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    }),
    prisma.disputation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const cards: WishCard[] = wishes.map((row) => ({
    id: row.id,
    wish: row.wish,
    outcome: row.outcome,
    obstacle: row.obstacle,
    plan: row.plan,
    status: row.status,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdLabel: day.format(row.createdAt),
    settledLabel: row.settledAt ? day.format(row.settledAt) : null,
  }));

  return {
    active: cards.filter((card) => card.status === "ACTIVE"),
    // Most recently settled first: what you just finished is what you want
    // to see when you open the drawer.
    settled: cards
      .filter((card) => card.status !== "ACTIVE")
      .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? "")),
    disputations: disputations.map((row) => ({
      id: row.id,
      adversity: row.adversity,
      belief: row.belief,
      beliefBefore: row.beliefBefore,
      consequences: row.consequences,
      evidence: row.evidence ?? "",
      alternatives: row.alternatives ?? "",
      implications: row.implications ?? "",
      usefulness: row.usefulness ?? "",
      energization: row.energization,
      beliefAfter: row.beliefAfter,
      createdAt: row.createdAt.toISOString(),
      createdLabel: day.format(row.createdAt),
    })),
  };
}
