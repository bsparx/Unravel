"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Flag, MoreHorizontal, Pencil, Plus, Sparkles } from "lucide-react";
import { Collapsible } from "radix-ui";
import { toast } from "sonner";

import { setLeadIdentity } from "@/app/(app)/identities/actions";
import { IdentitySigil, hueStyle } from "@/components/identity-sigil";
import { StarterPicker } from "@/components/starter-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ARCHETYPES, MAX_IDENTITIES, isArchetype, stageFor } from "@/lib/identity-look";
import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import { cn } from "@/lib/utils";

import { IdentityDialog } from "./identity-dialog";
import type { BoardIdentity } from "./types";

type HabitOption = { id: string; title: string; archived: boolean };

/** The server remains the source of truth for every vote and linked habit. */
export function IdentityBoard({
  identities,
  focus,
  habits,
  unlinked,
  pendingHabitIds,
  leadId,
}: {
  identities: BoardIdentity[];
  focus: IdentityReinforcement[];
  habits: HabitOption[];
  unlinked: { id: string; title: string }[];
  pendingHabitIds: string[];
  leadId: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<BoardIdentity | null>(null);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const full = identities.length >= MAX_IDENTITIES;
  const focusIds = new Set(focus.map((identity) => identity.id));
  const pendingIds = new Set(pendingHabitIds);
  const cast = identities.map(({ name, colorSlot }) => ({ name, colorSlot }));

  const close = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground text-label">
          {full ? "Six selves is the most Unravel holds." : "Stages count every vote. Details cover the last 30 days."}
        </p>
        <div className="flex flex-wrap gap-2">
          {identities.length > 0 && (
            <Button variant="secondary" onClick={() => setStarting(true)} disabled={full}>
              <Sparkles className="size-4" aria-hidden />
              From a character
            </Button>
          )}
          <Button onClick={() => setCreating(true)} disabled={full}>
            <Plus className="size-4" aria-hidden />
            Add identity
          </Button>
        </div>
      </div>

      {identities.some((identity) => identity.tally.month > 0) && (
        <WholeSelf identities={identities} leadId={leadId} />
      )}

      {identities.length === 0 ? (
        <section aria-labelledby="starter-title">
          <h2 id="starter-title" className="font-sans text-xl font-semibold">Begin as someone</h2>
          <p className="text-muted-foreground mt-1 mb-5 max-w-prose text-label">
            Pick a character and their first habits come with them, already linked. Keeping a
            habit&apos;s minimum counts as a vote. Or use Add identity to name your own.
          </p>
          <StarterPicker cast={cast} />
        </section>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              isLead={identity.id === leadId}
              needsAttention={focusIds.has(identity.id) && identity.missed > 0}
              pendingHabit={identity.linked.find((habit) => pendingIds.has(habit.habitId))}
              onEdit={() => setEditing(identity)}
            />
          ))}
        </ul>
      )}

      {unlinked.length > 0 && <UnlinkedHabitsSection habits={unlinked} />}

      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] p-5 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl font-semibold">Begin as someone</DialogTitle>
            <DialogDescription>
              A character with its first habits, already linked. You can change any of it later.
            </DialogDescription>
          </DialogHeader>
          <StarterPicker cast={cast} onAdopted={() => setStarting(false)} />
        </DialogContent>
      </Dialog>

      {(creating || editing) && (
        <IdentityDialog
          key={editing?.id ?? "new"}
          identity={editing}
          habits={habits}
          usedSlots={identities.filter((item) => item.id !== editing?.id).map((item) => item.colorSlot)}
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
  isLead,
  needsAttention,
  pendingHabit,
  onEdit,
}: {
  identity: BoardIdentity;
  isLead: boolean;
  needsAttention: boolean;
  pendingHabit: IdentityReinforcement["linked"][number] | undefined;
  onEdit: () => void;
}) {
  const reviewHabit = identity.starving[0];
  const stage = stageFor(identity.tally.total);
  const stripVotes = identity.tally.strip.filter(Boolean).length;
  const meta = [
    identity.kind === "REAL" ? "Real" : identity.kind === "FICTIONAL" ? "Fictional" : null,
    identity.archetype,
  ].filter(Boolean);

  return (
    <li
      style={hueStyle(identity.colorSlot)}
      className={cn(
        "border-border bg-card min-w-0 rounded-[20px] border p-5 sm:p-6",
        isLead && "border-[color-mix(in_srgb,var(--hue)_55%,transparent)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <IdentitySigil sigil={identity.sigil} slot={identity.colorSlot} size="lg" />
          <div className="min-w-0">
            <h2 className="font-sans text-xl leading-snug font-semibold break-words">{identity.name}</h2>
            {meta.length > 0 && (
              <p className="text-muted-foreground text-label">{meta.join(" · ")}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-muted-foreground" aria-label={`More for ${identity.name}`}>
              <MoreHorizontal className="size-4" aria-hidden />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onSelect={onEdit} className="min-h-11">
              <Pencil className="size-4" aria-hidden />
              Edit identity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {identity.statement && <p className="mt-4 max-w-prose text-body font-medium break-words">{identity.statement}</p>}

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3 text-label">
          <span className="font-semibold">
            Stage {stage.number} of 5: {stage.name}
          </span>
          <span className="text-muted-foreground">
            <span className="font-mono tabular-nums">{identity.tally.total}</span>{" "}
            {identity.tally.total === 1 ? "vote" : "votes"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`${identity.name}, progress to the next stage`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stage.progress}
          aria-valuetext={stage.next ? `${stage.next.votesToGo} votes to ${stage.next.name}` : "Final stage reached"}
          className="mt-2 h-2 overflow-hidden rounded bg-[color-mix(in_srgb,var(--hue)_18%,transparent)]"
        >
          <div className="h-full rounded-r bg-[var(--hue)]" style={{ width: `${stage.progress}%` }} />
        </div>
        <p className="text-muted-foreground mt-1.5 text-micro">
          {stage.next ? `${stage.next.votesToGo} more to ${stage.next.name}` : "Every vote keeps it that way."}
        </p>
      </div>

      {identity.tally.strip.length > 0 && (
        <div className="mt-4">
          <div className="text-muted-foreground flex justify-between gap-3 text-micro">
            <span>Last 14 days</span>
            <span>
              {stripVotes} {stripVotes === 1 ? "day" : "days"} with a vote
            </span>
          </div>
          <div
            role="img"
            aria-label={`Last 14 days: ${stripVotes} with a vote. Blank days are neutral.`}
            className="mt-1.5 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]"
          >
            {identity.tally.strip.map((on, index) => (
              <span
                key={index}
                className={cn(
                  "h-3.5 rounded-[3px]",
                  on ? "bg-[var(--hue)]" : "bg-[color-mix(in_srgb,var(--hue)_8%,transparent)] ring-1 ring-border ring-inset",
                  index === identity.tally.strip.length - 1 && "outline-foreground outline-[1.5px] outline-offset-1 outline",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {identity.question && (
        <p className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--hue)_9%,transparent)] px-3.5 py-3 text-body">
          <span className="text-muted-foreground block text-micro font-semibold">
            Ask like {identity.short}
          </span>
          {identity.question}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LeadButton identity={identity} isLead={isLead} />
      </div>

      {identity.linked.length === 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-prose text-label">
            Link a habit to start gathering evidence for this identity.
          </p>
          <Button variant="secondary" onClick={onEdit}>Link habits</Button>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mt-5 text-label">
            Last 30 days:{" "}
            <span className="text-foreground font-mono font-medium tabular-nums">{identity.tally.month}</span>{" "}
            {identity.tally.month === 1 ? "vote" : "votes"} from {identity.expected} due{" "}
            {identity.expected === 1 ? "check-in" : "check-ins"}
          </p>

          <div className="mt-4 space-y-2">
            <p className="text-muted-foreground text-label">Habits that support this</p>
            <ul className="flex flex-wrap gap-2">
              {identity.linked.map((habit) => (
                <li key={habit.habitId} className="min-w-0 max-w-full">
                  <Link
                    href={`/habits/${habit.habitId}`}
                    aria-label={`Edit habit: ${habit.title}`}
                    className="border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 max-w-full items-center rounded-lg border px-3 py-2 text-label break-words transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <Pencil className="mr-2 size-3.5 shrink-0" aria-hidden />
                    {habit.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {pendingHabit ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground max-w-prose text-label">
                {pendingHabit.title} is due today. Its minimum is enough.
              </p>
              <Button variant="secondary" asChild>
                <Link href={`/habits#habit-${pendingHabit.habitId}`}>
                  Check in <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : needsAttention && reviewHabit ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground max-w-prose text-label">
                Make {reviewHabit.title} easier to return to. You can adjust its minimum or schedule.
              </p>
              <Button variant="secondary" asChild>
                <Link href={`/habits/${reviewHabit.habitId}`}>Review habit</Link>
              </Button>
            </div>
          ) : null}
        </>
      )}

      {(identity.linked.length > 0 || identity.characteristics || identity.archetype) && (
        <Collapsible.Root className="border-border mt-5 border-t pt-2">
          <Collapsible.Trigger asChild>
            <Button variant="ghost" className="text-muted-foreground group -ml-2 justify-start">
              Details &amp; history
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content className="space-y-5 pt-3">
            {isArchetype(identity.archetype) && (
              <div className="space-y-1">
                <h3 className="text-label font-medium">{identity.archetype}</h3>
                <p className="text-muted-foreground text-body">{ARCHETYPES[identity.archetype]}</p>
              </div>
            )}
            {identity.characteristics && (
              <div className="space-y-2">
                <h3 className="text-label font-medium">How they move</h3>
                <p className="text-muted-foreground max-w-prose text-body break-words whitespace-pre-wrap">{identity.characteristics}</p>
              </div>
            )}
            {identity.linked.length > 0 && (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  <Cell label="Reinforcement" value={`${identity.reinforcement}%`} detail="Votes as a share of due check-ins" />
                  <Cell label="Optional extra" value={String(identity.wentBeyondVotes)} detail="Kept going after the minimum" />
                  <Cell label="Skipped" value={String(identity.skipped)} detail="A deliberate pause, not a miss" />
                  <Cell label="Not recorded" value={String(identity.missed)} detail="Past due check-ins without a vote" />
                  <Cell label="Still open today" value={String(identity.pending)} />
                  <Cell label="Due days since a vote" value={String(identity.coldDueDays)} detail="Days off are outside this count" />
                </dl>
                <div>
                  <h3 className="text-label font-medium">Daily votes</h3>
                  <p className="text-muted-foreground mt-1 text-label">
                    Select a day for its tally. Skipped days and days off stay neutral.
                  </p>
                  <VoteHistory daily={identity.daily} />
                </div>
              </>
            )}
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </li>
  );
}

/** Zero votes is neutral here: the tally cannot distinguish skips from misses. */
function VoteHistory({ daily }: { daily: IdentityReinforcement["daily"] }) {
  return (
    <ul className="mt-3 grid grid-cols-4 gap-1.5 min-[420px]:grid-cols-5 sm:grid-cols-7">
      {daily.map((day) => {
        const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${day.dateISO}T00:00:00Z`));
        const tally = day.due === 0
          ? "Nothing due"
          : `${day.votes} ${day.votes === 1 ? "vote" : "votes"} from ${day.due} due ${day.due === 1 ? "check-in" : "check-ins"}`;

        return (
          <li key={day.dateISO} className="min-w-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={`${date}: ${tally}`}
                  className={cn(
                    "border-border h-auto min-h-11 w-full flex-col gap-0.5 rounded-lg border px-1 py-2 font-mono text-xs tabular-nums",
                    day.touched ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                  )}
                >
                  {day.dateISO.slice(-2)}
                  {day.touched ? <Check className="size-3" aria-hidden /> : <span className="h-3 text-[10px]">{day.due > 0 ? "0" : "-"}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-[calc(100vw-2rem)] p-4">
                <p className="font-medium">{date}</p>
                <p>{tally}</p>
                {day.due > 0 && day.votes === 0 && (
                  <p className="text-muted-foreground">A skipped check-in records a deliberate pause. It does not count as a miss.</p>
                )}
              </PopoverContent>
            </Popover>
          </li>
        );
      })}
    </ul>
  );
}

function UnlinkedHabitsSection({ habits }: { habits: { id: string; title: string }[] }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1.5">
        <h2 className="font-sans text-xl font-semibold">Habits without an identity</h2>
        <p className="text-muted-foreground max-w-prose text-label">
          Linking is optional. Open a habit to choose which identities its kept days support.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {habits.map((habit) => (
          <li key={habit.id} className="min-w-0 max-w-full">
            <Link
              href={`/habits/${habit.id}`}
              aria-label={`Edit habit: ${habit.title}`}
              className="border-border hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 max-w-full items-center rounded-lg border px-3 py-2 text-label break-words transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <Pencil className="mr-2 size-3.5 shrink-0" aria-hidden />
              {habit.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-label">{label}</dt>
      <dd className="font-mono text-body font-medium tabular-nums">{value}</dd>
      {detail && <dd className="text-muted-foreground text-label">{detail}</dd>}
    </div>
  );
}

/** Lead today: the toggle on each card and the balance note. */
function LeadButton({ identity, isLead }: { identity: BoardIdentity; isLead: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={isLead ? "secondary" : "outline"}
      aria-pressed={isLead}
      aria-busy={pending}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setLeadIdentity(isLead ? null : identity.id);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(isLead ? `${identity.short} no longer leads today.` : `${identity.short} leads today.`);
          router.refresh();
        })
      }
    >
      <Flag className="size-4" aria-hidden />
      {isLead ? "Leads today" : "Lead today"}
    </Button>
  );
}

/**
 * The whole self: every identity's share of the month's votes as one
 * part-to-whole bar, a legend with the numbers (so colour is never the only
 * channel), and a pointer at the quietest self. Static markup, no chart
 * library: a flex row with a 2px gap is the whole chart.
 */
function WholeSelf({ identities, leadId }: { identities: BoardIdentity[]; leadId: string | null }) {
  const total = identities.reduce((sum, identity) => sum + identity.tally.month, 0);
  const shown = identities.filter((identity) => identity.tally.month > 0);
  const quiet = identities
    .filter((identity) => identity.linked.length > 0)
    .sort((a, b) => b.tally.quietDays - a.tally.quietDays || a.tally.month - b.tally.month)[0];
  const share = (votes: number) => Math.round((votes / total) * 100);

  return (
    <section aria-labelledby="whole-self-title" className="border-border bg-card rounded-[20px] border p-5 sm:p-6">
      <h2 id="whole-self-title" className="font-sans text-title font-semibold">
        The whole self
      </h2>
      <p className="text-muted-foreground text-label">Votes from the last 28 days, by identity</p>

      <div className="mt-4 flex h-6 gap-0.5" aria-hidden>
        {shown.map((identity, index) => (
          <div
            key={identity.id}
            style={{ ...hueStyle(identity.colorSlot), flex: `${identity.tally.month} 1 0` }}
            className={cn("min-w-1 bg-[var(--hue)]", index === shown.length - 1 && "rounded-r")}
            title={`${identity.short}: ${identity.tally.month} votes`}
          />
        ))}
      </div>

      <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-2 text-label">
        {identities.map((identity) => (
          <li key={identity.id} style={hueStyle(identity.colorSlot)} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-[3px] bg-[var(--hue)]" />
            {identity.short}
            <strong className="text-foreground font-semibold">
              {identity.tally.month} {identity.tally.month === 1 ? "vote" : "votes"}
              {total > 0 && <span className="text-muted-foreground font-normal"> ({share(identity.tally.month)}%)</span>}
            </strong>
          </li>
        ))}
      </ul>

      {quiet && quiet.tally.quietDays >= 3 && (
        <div className="bg-muted mt-5 flex flex-wrap items-center gap-4 rounded-2xl p-4">
          <IdentitySigil sigil={quiet.sigil} slot={quiet.colorSlot} />
          <p className="text-muted-foreground min-w-0 flex-[1_1_16rem] text-label">
            <strong className="text-foreground block text-body font-semibold">
              {quiet.short} has been quiet for {quiet.tally.quietDays} days.
            </strong>
            {quiet.linked[0]
              ? `The smallest vote is ${quiet.linked[0].title}. Nothing is lost; it's waiting.`
              : "One small habit is enough to begin."}
          </p>
          {quiet.id !== leadId && <LeadButton identity={quiet} isLead={false} />}
        </div>
      )}
    </section>
  );
}
