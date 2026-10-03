import { Gift, Lock, Repeat, Scroll } from "lucide-react";

import { IdentitySigil, hueStyle } from "@/components/identity-sigil";
import { InfoTip } from "@/components/info-tip";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRewards } from "@/lib/rewards";
import { cn } from "@/lib/utils";

import {
  AddTreatDialog,
  CloseChapterButton,
  ObjectiveLog,
  StartChapterDialog,
  TreatButtons,
} from "./_components/treat-controls";

export const metadata = { title: "Treats and chapters" };

/**
 * Habitica's rewards and quests, without gold or bosses: treats unlock with
 * votes (nothing is spent), and chapters are short stories for one identity.
 */
export default async function TreatsPage() {
  const user = await requireUser();
  const [{ treats, chapters, finished }, identities, habits] = await Promise.all([
    getRewards(user),
    prisma.identity.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { userId: user.id, type: "HABIT", archivedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">Treats and chapters</h1>
        <p className="text-muted-foreground mt-2 max-w-prose text-body">
          Rewards that suit the person you&apos;re becoming, and longer stories to grow into.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="treats-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="treats-title" className="font-sans text-heading font-semibold">
              Treats <InfoTip term="treats" className="ml-1" />
            </h2>
            <AddTreatDialog identities={identities} />
          </div>
          {treats.length === 0 ? (
            <p className="bg-muted text-muted-foreground rounded-2xl p-5 text-label">
              No treats yet. Add one that rewards the identity, like running shoes for the one who trains.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {treats.map((treat) => {
                const progress = Math.min(100, Math.round((treat.have / treat.votesNeeded) * 100));
                return (
                  <li
                    key={treat.id}
                    style={treat.identity ? hueStyle(treat.identity.colorSlot) : undefined}
                    className={cn(
                      "border-border bg-muted grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl border p-4",
                      treat.ready && "bg-card border-[color-mix(in_srgb,var(--hue,var(--primary))_50%,transparent)]",
                    )}
                  >
                    <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--hue,var(--primary))_14%,var(--input-surface))] text-[var(--hue,var(--primary))]">
                      <Gift className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-title font-semibold break-words">{treat.name}</h3>
                      <p className="text-muted-foreground text-micro">
                        {treat.identity ? `For ${treat.identity.short}, at ${treat.votesNeeded} votes` : `For the whole cast, at ${treat.votesNeeded} votes this week`}
                      </p>
                      <div
                        role="progressbar"
                        aria-label={treat.name}
                        aria-valuemin={0}
                        aria-valuemax={treat.votesNeeded}
                        aria-valuenow={Math.min(treat.have, treat.votesNeeded)}
                        aria-valuetext={`${treat.have} of ${treat.votesNeeded} votes`}
                        className="mt-2 h-2 max-w-72 overflow-hidden rounded bg-[color-mix(in_srgb,var(--hue,var(--primary))_18%,transparent)]"
                      >
                        <div className="h-full rounded-r bg-[var(--hue,var(--primary))]" style={{ width: `${progress}%` }} />
                      </div>
                      {!treat.ready && (
                        <p className="text-muted-foreground mt-1.5 inline-flex items-center gap-1.5 text-micro">
                          <Lock className="size-3.5" aria-hidden />
                          {treat.votesNeeded - treat.have} {treat.votesNeeded - treat.have === 1 ? "vote" : "votes"} to go
                        </p>
                      )}
                    </div>
                    <TreatButtons treatId={treat.id} name={treat.name} ready={treat.ready} enjoyed={treat.enjoyed} />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-muted-foreground mt-3 text-micro">
            Votes unlock a treat. Nothing is spent, so enjoying one never costs you progress.
          </p>
        </section>

        <section aria-labelledby="chapters-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="chapters-title" className="font-sans text-heading font-semibold">
              Chapters <InfoTip term="chapters" className="ml-1" />
            </h2>
            <StartChapterDialog identities={identities} habits={habits} />
          </div>
          {chapters.length === 0 ? (
            <p className="bg-muted text-muted-foreground rounded-2xl p-5 text-label">
              {identities.length === 0
                ? "Add an identity first. Chapters are stories for one of them."
                : "No chapter open. Start a short one: three objectives over ten days is plenty."}
            </p>
          ) : (
            <ul className="space-y-5">
              {chapters.map((chapter) => (
                <li key={chapter.id} style={hueStyle(chapter.identity.colorSlot)} className="border-border bg-card rounded-[20px] border p-5 sm:p-6">
                  <div className="flex items-center gap-3.5">
                    <IdentitySigil sigil={chapter.identity.sigil} slot={chapter.identity.colorSlot} size="lg" />
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-micro">{chapter.identity.short} · Chapter {chapter.number}</p>
                      <h3 className="font-sans text-xl font-semibold break-words">{chapter.title}</h3>
                    </div>
                  </div>
                  {chapter.intro && <p className="text-muted-foreground mt-3 text-body">{chapter.intro}</p>}
                  <div role="img" aria-label={`Day ${chapter.day} of ${chapter.lengthDays}`} className="mt-4 flex gap-1">
                    {Array.from({ length: chapter.lengthDays }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-2.5 flex-1 rounded-[3px]",
                          index < chapter.day ? "bg-[var(--hue)]" : "bg-[color-mix(in_srgb,var(--hue)_14%,transparent)]",
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-2 text-micro">Day {chapter.day} of {chapter.lengthDays}</p>

                  <ul className="mt-4">
                    {chapter.objectives.map((objective) => {
                      const done = objective.have >= objective.target;
                      return (
                        <li key={objective.id} className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t py-3">
                          <div className="min-w-0">
                            <p className={cn("text-body font-medium break-words", done && "text-muted-foreground")}>{objective.text}</p>
                            <p className="text-muted-foreground text-micro">
                              {Math.min(objective.have, objective.target)} of {objective.target}
                              {objective.habit ? ` days of ${objective.habit.title}` : ""}
                            </p>
                            <div className="mt-1.5 h-1.5 max-w-60 overflow-hidden rounded bg-[color-mix(in_srgb,var(--hue)_18%,transparent)]" aria-hidden>
                              <div className="h-full rounded-r bg-[var(--hue)]" style={{ width: `${Math.min(100, Math.round((objective.have / objective.target) * 100))}%` }} />
                            </div>
                          </div>
                          {objective.habit ? (
                            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-micro">
                              <Repeat className="size-3.5" aria-hidden />From the daily
                            </span>
                          ) : (
                            <ObjectiveLog objectiveId={objective.id} text={objective.text} have={objective.have} target={objective.target} />
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="bg-muted mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                    <p className="text-muted-foreground flex min-w-0 flex-[1_1_14rem] items-start gap-2.5 text-label">
                      <Scroll className="mt-0.5 size-4 shrink-0 text-[var(--hue)]" aria-hidden />
                      {chapter.complete
                        ? "Every objective is in. Close the chapter when you're ready."
                        : chapter.reward
                          ? `Finishing unlocks ${chapter.reward}. A missed day simply waits.`
                          : "A missed day simply waits."}
                    </p>
                    <CloseChapterButton chapterId={chapter.id} complete={chapter.complete} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {finished.length > 0 && (
            <div className="mt-6">
              <h3 className="text-muted-foreground mb-2 text-label font-semibold">Closed chapters</h3>
              <ul className="space-y-1">
                {finished.map((chapter) => (
                  <li key={chapter.id} className="text-muted-foreground flex items-center gap-2 text-label">
                    <IdentitySigil sigil={chapter.identity.sigil} slot={chapter.identity.colorSlot} size="sm" />
                    {chapter.identity.short}, chapter {chapter.number}: {chapter.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
