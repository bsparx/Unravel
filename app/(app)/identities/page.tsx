import { requireUser } from "@/lib/auth";
import { getHabitStats } from "@/lib/habit-stats";
import { getIdentityReinforcements } from "@/lib/identity-stats";
import { getIdentityVotes, getLeadIdentityId } from "@/lib/identity-votes";

import { IdentityBoard } from "./_components/identity-board";
import type { BoardIdentity } from "./_components/types";
import { InfoTip } from "@/components/info-tip";

export const metadata = { title: "Identities" };

/**
 * Who you are becoming.
 *
 * The identity layer's home: the identities themselves, their statements, the
 * habits that vote for them, and the tally for the last 30 days. Management
 * happens in dialogs on this screen; the numbers come from the same pure tally
 * `/habits/stats` shows.
 */
export default async function IdentitiesPage() {
  const user = await requireUser();
  // Everything in one round. The reinforcement takes the stats still in
  // flight: its own query runs now and only its arithmetic waits for them.
  const statsRead = getHabitStats(user, "month");
  const [stats, votes, leadId, { identities: reinforced, focus }] = await Promise.all([
    statsRead,
    getIdentityVotes(user),
    getLeadIdentityId(user),
    getIdentityReinforcements(
      user,
      statsRead.then((read) => read.habits),
      "month",
    ),
  ]);
  const profiles = new Map(votes.identities.map((identity) => [identity.id, identity]));
  const identities: BoardIdentity[] = reinforced.flatMap((identity) => {
    const profile = profiles.get(identity.id);
    if (!profile) return [];
    return [{
      ...identity,
      short: profile.short,
      kind: profile.kind,
      archetype: profile.archetype,
      question: profile.question,
      colorSlot: profile.colorSlot,
      sigil: profile.sigil,
      tally: profile.votes,
    }];
  });

  // Habits nobody is evidence for. Derived here rather than in the board so
  // the rule ("a habit counts only if some identity lists it") lives next to
  // the queries that produce both sides. Archived habits are retired, not
  // missing votes — they stay out.
  const linkedIds = new Set(
    identities.flatMap((identity) =>
      identity.linked.map((habit) => habit.habitId),
    ),
  );
  const unlinked = stats.allHabits.filter(
    (habit) => !habit.archived && !linkedIds.has(habit.id),
  );
  const pendingHabitIds = stats.habits
    .filter((habit) =>
      !habit.archived && habit.days.some(
        (day) => day.dateISO === stats.toISO && day.outcome === "PENDING",
      ),
    )
    .map((habit) => habit.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">
          Identities <InfoTip term="identity" className="ml-1" />
        </h1>
        <p className="text-muted-foreground mt-2 max-w-prose text-body">
          Jung saw one personality as a cast of smaller selves. Name yours
          after someone real or fictional, then let small habits vote for them.
        </p>
      </header>

      <IdentityBoard
        identities={identities}
        focus={focus}
        habits={stats.allHabits}
        unlinked={unlinked}
        pendingHabitIds={pendingHabitIds}
        leadId={leadId}
      />
    </div>
  );
}
