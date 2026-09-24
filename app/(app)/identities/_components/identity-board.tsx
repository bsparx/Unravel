"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserRound } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import { cn } from "@/lib/utils";

import { IdentityDialog } from "./identity-dialog";

type HabitOption = { id: string; title: string; archived: boolean };

/**
 * The identities, their tallies, and the two panels that say who to worry
 * about: habits that are nobody's evidence yet, and identities going hungry.
 * All management happens in the dialog — one screen, one decision at a time —
 * and every mutation refreshes the server props rather than keeping a second
 * copy of the tally in client state that could disagree with the page.
 */
export function IdentityBoard({
  identities,
  focus,
  habits,
  unlinked,
}: {
  identities: IdentityReinforcement[];
  focus: IdentityReinforcement[];
  habits: HabitOption[];
  unlinked: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<IdentityReinforcement | null>(null);
  const [creating, setCreating] = useState(false);

  const close = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-label">Last 30 days.</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Add identity
        </Button>
      </div>

      {identities.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No identities yet"
          description="Name who you want to become — a writer, an athlete — then link the habits that are evidence for it. The tally starts the same day."
        />
      ) : (
        <ul className="space-y-3">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              onEdit={() => setEditing(identity)}
            />
          ))}
        </ul>
      )}

      {unlinked.length > 0 && <UnlinkedHabitsSection habits={unlinked} />}

      {focus.length > 0 && <NeedsFocusSection focus={focus} />}

      {(creating || editing) && (
        <IdentityDialog
          // Keyed so the form mounts with the right values every time — a
          // dialog kept alive between edits would show the last one's state.
          key={editing?.id ?? "new"}
          identity={editing}
          habits={habits}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        />
      )}
    </div>
  );
}

function IdentityCard({
  identity,
  onEdit,
}: {
  identity: IdentityReinforcement;
  onEdit: () => void;
}) {
  return (
    <li className="border-border bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-title">{identity.name}</h2>
          {identity.statement && <p className="mt-0.5 text-label">{identity.statement}</p>}
          {identity.characteristics && (
            <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap text-label">
              {identity.characteristics}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      </div>

      {identity.linked.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-label">
          No habits voting for this one yet — link one to start the tally.
        </p>
      ) : (
        <>
          {/* One bar, split by outcome. Left to right, best to worst — the
              shape of the row is the summary. */}
          <div className="bg-muted mt-3 flex h-2 w-full overflow-hidden rounded-full">
            <Segment value={identity.votes} total={identity.expected} className="bg-primary" label={`${identity.votes} days voted`} />
            <Segment value={identity.skipped} total={identity.expected} className="bg-muted-foreground/30" label={`${identity.skipped} skipped`} />
            <Segment value={identity.missed} total={identity.expected} className="bg-destructive/45" label={`${identity.missed} missed`} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label sm:grid-cols-4">
            <Cell label="Votes" value={String(identity.votes)} detail={`of ${identity.expected} due`} />
            <Cell label="Reinforced" value={`${identity.reinforcement}%`} />
            <Cell
              label="Kept going"
              value={String(identity.wentBeyondVotes)}
              detail={identity.votes > 0 ? "of days voted" : undefined}
            />
            <Cell
              label="Missed"
              value={String(identity.missed)}
              detail={identity.skipped > 0 ? `${identity.skipped} skipped on purpose` : undefined}
            />
          </dl>

          {identity.coldDueDays > 0 && (
            <p className="text-destructive/80 mt-2 text-label">
              {identity.coldDueDays} due{" "}
              {identity.coldDueDays === 1 ? "day" : "days"} without a vote.
            </p>
          )}

          <Strip daily={identity.daily} />

          <p className="text-muted-foreground mt-2 flex flex-wrap gap-1.5">
            {identity.linked.map((habit) => (
              <span
                key={habit.habitId}
                className="border-border rounded-full border px-2 py-0.5 text-micro"
              >
                {habit.title}
              </span>
            ))}
          </p>
        </>
      )}
    </li>
  );
}

/** The touched strip: filled means at least one vote that day. */
function Strip({ daily }: { daily: IdentityReinforcement["daily"] }) {
  return (
    <div
      className="mt-3 flex gap-0.5"
      role="img"
      aria-label="Days this identity got a vote, last 30 days"
    >
      {daily.map((day) => (
        <span
          key={day.dateISO}
          title={
            day.due === 0
              ? `${day.dateISO} — nothing due`
              : `${day.dateISO} — ${day.votes} of ${day.due} votes`
          }
          className={cn(
            "h-4 flex-1 rounded-sm",
            day.touched
              ? "bg-primary"
              : day.due > 0
                ? "bg-destructive/35"
                : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Habits that are nobody's evidence yet. A setup gap, not a verdict: the
 * habit exists, it just isn't counted for any self until it is linked. Each
 * name goes to the habit form, where the identity chips already live.
 */
function UnlinkedHabitsSection({
  habits,
}: {
  habits: { id: string; title: string }[];
}) {
  return (
    <section>
      <h2 className="font-display text-title">Not voting yet</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 max-w-prose text-label">
        These habits are nobody&apos;s evidence yet. Link one and its kept
        days start counting as votes.
      </p>
      <ul className="space-y-3">
        {habits.map((habit) => (
          <li
            key={habit.id}
            className="border-border bg-card rounded-lg border p-4"
          >
            <Link
              href={`/habits/${habit.id}`}
              className="text-foreground hover:text-primary underline underline-offset-4"
            >
              {habit.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The hungry ones. Deliberately a pointer, not a verdict: the identities with
 * the fewest votes in the range, with the specific habits that cost them.
 */
function NeedsFocusSection({ focus }: { focus: IdentityReinforcement[] }) {
  return (
    <section>
      <h2 className="font-display text-title">Needs focus</h2>
      <p className="text-muted-foreground mt-0.5 mb-3 max-w-prose text-label">
        The identities with the fewest votes lately, and the habits that
        missed. Not a verdict — a pointer.
      </p>
      <ul className="space-y-3">
        {focus.map((identity) => (
          <li key={identity.id} className="border-border bg-card rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-body">{identity.name}</h3>
              <span className="text-label tabular-nums">
                {identity.reinforcement}%
                <span className="text-muted-foreground">
                  {" "}
                  · {identity.votes} of {identity.expected} votes
                </span>
              </span>
            </div>

            {identity.coldDueDays > 0 && (
              <p className="text-destructive/80 mt-1 text-label">
                {identity.coldDueDays} due{" "}
                {identity.coldDueDays === 1 ? "day" : "days"} without a vote.
              </p>
            )}

            {identity.starving.length > 0 && (
              <p className="text-muted-foreground mt-1 text-label">
                Missed:{" "}
                {identity.starving.map((habit, index) => (
                  <span key={habit.habitId}>
                    {index > 0 && " · "}
                    <Link
                      href={`/habits/${habit.habitId}`}
                      className="text-foreground hover:text-primary underline underline-offset-4"
                    >
                      {habit.title}
                    </Link>{" "}
                    <span className="tabular-nums">{habit.missed}×</span>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Segment({
  value,
  total,
  className,
  label,
}: {
  value: number;
  total: number;
  className: string;
  label: string;
}) {
  if (value <= 0 || total <= 0) return null;
  return (
    <span
      title={label}
      className={className}
      style={{ width: `${(value / total) * 100}%` }}
    />
  );
}

function Cell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <dt className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
        {label}
      </dt>
      <dd className="font-mono tabular-nums">{value}</dd>
      {detail && <p className="text-muted-foreground text-micro">{detail}</p>}
    </div>
  );
}