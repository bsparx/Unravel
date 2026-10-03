"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, Play, Sprout } from "lucide-react";
import { toast } from "sonner";

import { saveTodaysLead } from "@/app/(app)/identities/actions";

import { IdentitySigil, hueStyle } from "@/components/identity-sigil";
import { StarterPicker } from "@/components/starter-picker";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/info-tip";
import { formatMinutes } from "@/lib/dates";
import type { IdentityWithVotes } from "@/lib/identity-votes";
import type { TodayItem } from "@/lib/tasks";
import { buildTimerHref } from "@/lib/timer-url";

import { LeadPicker } from "./lead-picker";

/**
 * The identity layer's front door on /day: who leads today, the lead's next
 * kept-minimum, the question they bring, and the day's votes so far.
 *
 * A Client Component that already holds every identity and today's habits, so
 * switching the lead is local: the card redraws at once and the choice is saved
 * in the background, with no server render of the page. A failed save puts
 * back the last lead the server accepted.
 */
export function LeadPanel({
  identities,
  leadId: serverLeadId,
  habits,
}: {
  identities: IdentityWithVotes[];
  leadId: string | null;
  /** Today's due habits, from the day view. */
  habits: TodayItem[];
}) {
  const [leadId, setLeadId] = useState(serverLeadId);
  // A later server render (checking off a habit, say) brings the saved lead
  // back as a prop. Adopt it, the way React's docs adjust state to a prop.
  const [syncedFrom, setSyncedFrom] = useState(serverLeadId);
  if (serverLeadId !== syncedFrom) {
    setSyncedFrom(serverLeadId);
    setLeadId(serverLeadId);
  }
  const saved = useRef(serverLeadId);
  useEffect(() => {
    saved.current = serverLeadId;
  }, [serverLeadId]);
  // Only the newest press may roll the picker back. Next sends actions one at
  // a time, so saves land in the order they were made.
  const latest = useRef(0);
  const [, startTransition] = useTransition();

  const choose = (id: string) => {
    if (id === leadId) return;
    setLeadId(id);
    const request = ++latest.current;
    startTransition(async () => {
      try {
        const result = await saveTodaysLead(id);
        if (result.ok) {
          saved.current = id;
          return;
        }
        toast.error(result.message);
      } catch {
        toast.error("Couldn't save who leads today. Try again in a moment.");
      }
      if (request === latest.current) setLeadId(saved.current);
    });
  };

  // Habits but no cast: a nudge, not a takeover of a day that already has a
  // shape. /identities holds the same starter characters.
  if (identities.length === 0 && habits.length > 0) {
    return (
      <section className="border-border bg-card mb-8 flex flex-wrap items-center gap-4 rounded-[20px] border p-5">
        <Sprout className="text-accent-foreground size-5" aria-hidden />
        <p className="text-muted-foreground min-w-0 flex-[1_1_16rem] text-label">
          <strong className="text-foreground block text-body font-semibold">Who are you becoming?</strong>
          Name an identity after someone you admire, or begin as a ready-made character, and your habits become votes for them.
        </p>
        <Button asChild variant="secondary">
          <Link href="/identities">Add identity</Link>
        </Button>
      </section>
    );
  }

  // The first run: nothing yet, so offer a cast ready-made rather than a link
  // to three empty forms. Picking a character fills this page with its habits.
  if (identities.length === 0) {
    return (
      <section aria-labelledby="starter-title" className="mb-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-[1_1_20rem]">
            <h2 id="starter-title" className="flex items-center gap-2 font-sans text-xl font-semibold">
              <Sprout className="text-accent-foreground size-5" aria-hidden />
              Begin as someone
              <InfoTip term="starter" />
            </h2>
            <p className="text-muted-foreground mt-1 max-w-prose text-label">
              Pick a character. Their first habits come with them, already small, and
              each check-in is a vote for who you&apos;re becoming. You can change any of it later.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/identities">Or name your own</Link>
          </Button>
        </div>
        <StarterPicker cast={[]} />
      </section>
    );
  }

  const lead = identities.find((identity) => identity.id === leadId) ?? null;
  const next = lead
    ? habits.find((habit) => !habit.done && lead.habitIds.includes(habit.id))
    : undefined;
  const votesToday = identities.reduce((sum, identity) => sum + identity.votes.today, 0);
  const nameOf = new Map(identities.map((identity) => [identity.id, identity.short]));
  const votersFor = (habitId: string) =>
    identities.filter((identity) => identity.habitIds.includes(habitId)).map((identity) => nameOf.get(identity.id)!);

  return (
    <section
      aria-label="Who leads today"
      className="mb-8 grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
    >
      <div
        style={lead ? hueStyle(lead.colorSlot) : undefined}
        className="border-border bg-card min-w-0 rounded-[20px] border p-5 sm:p-6"
      >
        <LeadPicker
          options={identities.map(({ id, short, sigil, colorSlot }) => ({ id, short, sigil, colorSlot }))}
          leadId={leadId}
          onChange={choose}
        />

        {lead && (
          <div className="border-border mt-5 border-t pt-5">
            <p className="text-accent-foreground flex items-center gap-2 text-label font-semibold">
              <Flag className="size-4" aria-hidden />
              One place to start
            </p>
            <h2 className="font-display mt-2 text-[1.625rem] leading-tight font-medium tracking-tight">
              {next ? next.bar?.minimalTask || next.title : `Every vote for ${lead.short} is in`}
            </h2>
            <p className="text-muted-foreground mt-2 text-label">
              {next
                ? `${next.estimatedSeconds ? `${formatMinutes(next.estimatedSeconds)}, and ` : ""}a vote for ${listNames(votersFor(next.id))}`
                : "Pick anything else, or take a real break."}
            </p>
            {lead.question && (
              <p className="mt-4 flex items-start gap-3 rounded-xl bg-[color-mix(in_srgb,var(--hue)_9%,transparent)] px-3.5 py-3 text-body">
                <IdentitySigil sigil={lead.sigil} slot={lead.colorSlot} size="sm" />
                <span>
                  <span className="text-muted-foreground block text-micro font-semibold">
                    Ask like {lead.short} <InfoTip term="question" className="ml-0.5" />
                  </span>
                  {lead.question}
                </span>
              </p>
            )}
            {next && (
              <Button asChild className="mt-5 w-full">
                <Link href={buildTimerHref(next)}>
                  <Play className="size-4" aria-hidden />
                  Start focus
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-sans text-title font-semibold">
            Votes today <InfoTip term="vote" className="ml-1" />
          </h2>
          <span className="font-mono text-title font-semibold tabular-nums">{votesToday}</span>
        </div>
        <ul className="mt-2 space-y-0.5">
          {identities.map((identity) => (
            <li
              key={identity.id}
              className={`flex min-h-9 items-center gap-2.5 text-label ${identity.votes.today ? "" : "text-muted-foreground"}`}
            >
              <IdentitySigil sigil={identity.sigil} slot={identity.colorSlot} size="sm" />
              <span className="min-w-0 flex-1 truncate">{identity.short}</span>
              <span className="font-mono tabular-nums">
                {identity.votes.today}
                <span className="sr-only"> {identity.votes.today === 1 ? "vote" : "votes"}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2 text-micro">
          Every minimum you keep is a vote for someone you&apos;re becoming.
        </p>
      </div>
    </section>
  );
}

const listNames = (names: string[]): string =>
  names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
