"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, MoreHorizontal, Pencil, Plus, UserRound } from "lucide-react";
import { Collapsible } from "radix-ui";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import { cn } from "@/lib/utils";

import { IdentityDialog } from "./identity-dialog";

type HabitOption = { id: string; title: string; archived: boolean };

/** The server remains the source of truth for every vote and linked habit. */
export function IdentityBoard({
  identities,
  focus,
  habits,
  unlinked,
  pendingHabitIds,
}: {
  identities: IdentityReinforcement[];
  focus: IdentityReinforcement[];
  habits: HabitOption[];
  unlinked: { id: string; title: string }[];
  pendingHabitIds: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<IdentityReinforcement | null>(null);
  const [creating, setCreating] = useState(false);
  const focusIds = new Set(focus.map((identity) => identity.id));
  const pendingIds = new Set(pendingHabitIds);

  const close = () => {
    setCreating(false);
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground text-label">Last 30 days</p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Add identity
        </Button>
      </div>

      {identities.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No identities yet"
          description="Name who you want to become, then link a habit that helps you practise it. Keeping its minimum counts as a vote."
          className="rounded-[20px]"
        />
      ) : (
        <ul className="space-y-5">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              needsAttention={focusIds.has(identity.id) && identity.missed > 0}
              pendingHabit={identity.linked.find((habit) => pendingIds.has(habit.habitId))}
              onEdit={() => setEditing(identity)}
            />
          ))}
        </ul>
      )}

      {unlinked.length > 0 && <UnlinkedHabitsSection habits={unlinked} />}

      {(creating || editing) && (
        <IdentityDialog
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
  needsAttention,
  pendingHabit,
  onEdit,
}: {
  identity: IdentityReinforcement;
  needsAttention: boolean;
  pendingHabit: IdentityReinforcement["linked"][number] | undefined;
  onEdit: () => void;
}) {
  const reviewHabit = identity.starving[0];

  return (
    <li className="border-border bg-card min-w-0 rounded-[20px] border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="font-sans text-xl leading-snug font-semibold break-words">{identity.name}</h2>
          {identity.statement && <p className="max-w-prose text-body break-words">{identity.statement}</p>}
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

      {identity.linked.length === 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-prose text-label">
            Link a habit to start gathering evidence for this identity.
          </p>
          <Button variant="secondary" onClick={onEdit}>Link habits</Button>
        </div>
      ) : (
        <>
          <p className="mt-5 text-body">
            <span className="font-mono font-medium tabular-nums">{identity.votes}</span>{" "}
            {identity.votes === 1 ? "vote" : "votes"}
            <span className="text-muted-foreground">
              {" "}from {identity.expected} due {identity.expected === 1 ? "check-in" : "check-ins"}
            </span>
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

      {(identity.linked.length > 0 || identity.characteristics) && (
        <Collapsible.Root className="border-border mt-5 border-t pt-2">
          <Collapsible.Trigger asChild>
            <Button variant="ghost" className="text-muted-foreground group -ml-2 justify-start">
              Details &amp; history
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content className="space-y-5 pt-3">
            {identity.characteristics && (
              <div className="space-y-2">
                <h3 className="text-label font-medium">Characteristics</h3>
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
