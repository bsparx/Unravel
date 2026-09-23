import { requireUser } from "@/lib/auth";
import { getHabitStats } from "@/lib/habit-stats";
import { getIdentityReinforcements } from "@/lib/identity-stats";

import { IdentityBoard } from "./_components/identity-board";

export const metadata = { title: "Identities" };

/**
 * Who you are becoming.
 *
 * The identity layer's home: the identities themselves, their statements, the
 * habits that vote for them, and the tally for the last 30 days — what each
 * identity got, and which are going hungry. Management happens in dialogs on
 * this one screen; the reinforcement numbers come from the same pure tally
 * `/habits/stats` shows.
 */
export default async function IdentitiesPage() {
  const user = await requireUser();
  const stats = await getHabitStats(user, "month");
  const { identities, focus } = await getIdentityReinforcements(
    user,
    stats.habits,
    "month",
  );

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

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">Identities</h1>
        <p className="text-muted-foreground mt-1 max-w-prose text-label">
          Who you are becoming. Every habit kept is a vote for one of these —
          this is the tally for the last 30 days: how many votes each one got,
          and which ones are going hungry.
        </p>
      </header>

      <IdentityBoard
        identities={identities}
        focus={focus}
        habits={stats.allHabits}
        unlinked={unlinked}
      />
    </div>
  );
}