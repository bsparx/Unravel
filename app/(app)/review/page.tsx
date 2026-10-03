import { requireUser } from "@/lib/auth";
import { formatDate, startOfWeek, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getIdentityVotes } from "@/lib/identity-votes";
import { reviewWeekStart } from "@/lib/review-week";

import { Council, type CouncilIdentity } from "./_components/council";

export const metadata = { title: "Weekly review" };

/**
 * The weekly council: look back at the votes, make the quietest habit easier,
 * choose who leads the coming week. Jung's many selves, each given a hearing.
 */
export default async function ReviewPage() {
  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const weekStart = reviewWeekStart(today, user.weekStart);

  const [votes, existing] = await Promise.all([
    getIdentityVotes(user),
    prisma.weeklyReview.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      select: { statement: true, adjustment: true, leadIdentity: { select: { name: true } } },
    }),
  ]);

  const identities: CouncilIdentity[] = votes.identities.map((identity) => ({
    id: identity.id,
    short: identity.short,
    statement: identity.statement,
    sigil: identity.sigil,
    colorSlot: identity.colorSlot,
    last7: identity.votes.last7,
  }));
  const linked = votes.identities.filter((identity) => identity.habitIds.length > 0);
  const quietProfile = [...linked].sort(
    (a, b) => a.votes.last7 - b.votes.last7 || b.votes.quietDays - a.votes.quietDays,
  )[0];
  const quiet = quietProfile ? identities.find((identity) => identity.id === quietProfile.id)! : null;

  const habit = quietProfile
    ? await prisma.task.findFirst({
        where: { id: { in: quietProfile.habitIds }, userId: user.id, archivedAt: null, type: "HABIT" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, recurrence: { select: { minimalTask: true } } },
      })
    : null;

  const isThisWeek = weekStart.getTime() === startOfWeek(today, user.weekStart).getTime();
  const weekLabel = isThisWeek ? "this week" : `the week of ${formatDate(weekStart)}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">The weekly council</h1>
        <p className="text-muted-foreground mt-2 max-w-prose text-body">
          Once a week, each self gets a hearing. Three short questions, about ten minutes.
        </p>
      </header>

      {identities.length === 0 ? (
        <p className="bg-muted text-muted-foreground rounded-2xl p-5 text-label">
          The council needs members. Add an identity first, then come back at the end of the week.
        </p>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-[20px] border">
          <Council
            identities={identities}
            quiet={quiet}
            quietHabit={habit?.recurrence ? { id: habit.id, title: habit.title, minimum: habit.recurrence.minimalTask } : null}
            closed={existing ? { lead: existing.leadIdentity?.name ?? null, statement: existing.statement, adjustment: existing.adjustment } : null}
            weekLabel={weekLabel}
          />
        </div>
      )}
    </div>
  );
}
