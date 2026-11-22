"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Moon, Sparkles } from "lucide-react";

import type { PassOption } from "@/app/(focus)/_components/morning-pass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useExcludedItems } from "@/components/use-stats-selection";
import type { CloseStep } from "@/lib/close-ritual";
import { incompleteTodayItems } from "@/lib/ending-summary";
import {
  filterSelectedIds,
  type MissedHabitNote,
  type StatsDayRecord,
  type TrackableItem,
} from "@/lib/stats-summary";
import { cn } from "@/lib/utils";

import {
  bailOut,
  handOff,
  saveWorry,
  setTomorrowOneThing,
} from "../actions";
import { CloseStepNav } from "./close-chrome";
import { OpenHabitsCard } from "./open-habits-card";

/**
 * Calm evening sanctuary shell shared by Tomorrow, Clear mind, and Rest steps.
 * One frosted-glass panel on the atmospheric canvas, a quiet step trail at the
 * top, and a zero-guilt exit underneath.
 */
function Shell({
  step,
  includeSummary,
  dateLabel,
  title,
  subtitle,
  aboveCard,
  children,
}: {
  step: CloseStep;
  includeSummary: boolean;
  dateLabel: string;
  title: string;
  subtitle?: string;
  aboveCard?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="animate-rise">
        <CloseStepNav
          current={step}
          includeSummary={includeSummary}
          dateLabel={dateLabel}
        />
      </div>

      {aboveCard}

      <section className="bg-card animate-rise rounded-[28px] border border-[var(--card-edge)] p-6 shadow-[var(--card-shadow)] [animation-delay:60ms] sm:p-8">
        <h1 className="font-display text-display text-balance">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-2.5 text-body text-pretty">
            {subtitle}
          </p>
        )}
        <div className="mt-7">{children}</div>
      </section>

      <form action={bailOut} className="mt-7 px-1">
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded text-label underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          Leave it for tonight
        </button>
      </form>
    </main>
  );
}

export function StepOneThing({
  options,
  dateISO,
  dateLabel,
  includeSummary,
  todayItems,
  todayRecord,
  initialMissedNotes = [],
}: {
  options: PassOption[];
  dateISO: string;
  dateLabel: string;
  includeSummary: boolean;
  /** Provided when Ending Summary is off so open habits are still visible on /close. */
  todayItems?: readonly TrackableItem[];
  todayRecord?: Pick<StatsDayRecord, "items"> | null;
  initialMissedNotes?: readonly MissedHabitNote[];
}) {
  const [typed, setTyped] = useState("");
  const { excludedSet } = useExcludedItems();

  const openItems = useMemo(() => {
    if (includeSummary || !todayItems || !todayRecord) return [];
    const selectedIds = filterSelectedIds(todayItems, excludedSet);
    return incompleteTodayItems(todayItems, todayRecord, selectedIds);
  }, [includeSummary, todayItems, todayRecord, excludedSet]);

  const initialReasons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const note of initialMissedNotes) {
      map[note.itemId] = note.reason;
    }
    return map;
  }, [initialMissedNotes]);

  return (
    <Shell
      step="one-thing"
      includeSummary={includeSummary}
      dateLabel={dateLabel}
      title="What's tomorrow's one thing?"
      subtitle="Decide it now, while today is still in your head. Tomorrow morning it'll be waiting and you won't have to choose anything."
      aboveCard={
        openItems.length > 0 ? (
          <OpenHabitsCard
            openItems={openItems}
            reasonsByItemId={initialReasons}
            showAllCompleteBanner={false}
            className="animate-rise mb-5 [animation-delay:35ms]"
          />
        ) : null
      }
    >
      {options.length > 0 && (
        <ul className="mb-5 space-y-2">
          {options.map((option) => (
            <li key={`${option.kind}-${option.id}`}>
              <form action={setTomorrowOneThing}>
                <input type="hidden" name="date" value={dateISO} />
                <input
                  type="hidden"
                  name={option.kind === "task" ? "taskId" : "captureId"}
                  value={option.id}
                />
                <button
                  type="submit"
                  className="group border-border/75 bg-background/40 hover:border-primary/45 hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body font-medium">
                      {option.label}
                    </span>
                    {option.detail && (
                      <span className="text-muted-foreground text-label">
                        {option.detail}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={setTomorrowOneThing} className="flex gap-2">
        <input type="hidden" name="date" value={dateISO} />
        <label htmlFor="tomorrow-title" className="sr-only">
          Or type tomorrow&apos;s one thing
        </label>
        <Input
          id="tomorrow-title"
          name="title"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          maxLength={200}
          autoComplete="off"
          placeholder={
            options.length > 0 ? "Or something else…" : "Type it here…"
          }
          className="h-11 rounded-xl text-body"
        />
        <Button type="submit" className="h-11 rounded-xl px-5">
          Next
        </Button>
      </form>
    </Shell>
  );
}

export function StepWorry({
  initial,
  dateLabel,
  includeSummary,
}: {
  initial: string;
  dateLabel: string;
  includeSummary: boolean;
}) {
  return (
    <Shell
      step="worry"
      includeSummary={includeSummary}
      dateLabel={dateLabel}
      title="What's still on your mind?"
      subtitle="Put it here so you're not carrying it around all night. Nobody reads this, including the app — it's saved and then left alone."
    >
      <form action={saveWorry} className="space-y-5">
        <label htmlFor="worry" className="sr-only">
          Anything still on your mind
        </label>
        <Textarea
          id="worry"
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={initial}
          autoFocus
          placeholder="Anything at all. Or nothing — that's a fine answer too."
          className="resize-none rounded-2xl text-body"
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="submit" size="lg" className="min-h-11 rounded-xl px-5">
            Next
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </form>
    </Shell>
  );
}

export function StepHandoff({
  oneThing,
  dateLabel,
  includeSummary,
}: {
  oneThing: string | null;
  dateLabel: string;
  includeSummary: boolean;
}) {
  return (
    <Shell
      step="handoff"
      includeSummary={includeSummary}
      dateLabel={dateLabel}
      title="Done. Go and rest."
    >
      <div className="space-y-6">
        {oneThing ? (
          <div className="border-primary/30 bg-accent/35 rounded-2xl border px-4 py-3.5">
            <p className="text-accent-foreground flex items-center gap-1.5 text-micro font-semibold">
              <Sparkles className="size-3.5" aria-hidden />
              Waiting for you tomorrow
            </p>
            <p className="font-display mt-1 text-title text-foreground">
              {oneThing}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-body">
            Nothing else needs deciding tonight.
          </p>
        )}

        <form action={handOff}>
          <Button
            type="submit"
            size="lg"
            className={cn(
              "bg-rest text-rest-foreground hover:bg-rest/90 h-12 rounded-xl px-6",
            )}
          >
            <Moon className="size-4" aria-hidden />
            Start the recovery timer
          </Button>
        </form>

        <p className="text-muted-foreground text-label">
          It counts up, has no target, and stops when you say so. It gets logged
          exactly like work does.
        </p>
      </div>
    </Shell>
  );
}
