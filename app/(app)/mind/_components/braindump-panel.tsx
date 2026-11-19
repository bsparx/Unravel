"use client";

import { useState } from "react";
import { MoonStar, PenLine, Sunrise } from "lucide-react";

import { DumpEnvelope } from "@/components/dump-envelope";
import { GuideCard } from "@/components/guides/guide-card";
import { InfoTip } from "@/components/info-tip";
import { ritualGhostClass, ritualPrimaryClass } from "@/components/ritual-frame";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import {
  DUMP_COPY,
  DUMP_MINUTES,
  isBedtime,
  suggestedKind,
  type DumpKind,
  type DumpMinutes,
} from "@/lib/brain-dump";
import type { BrainDumpView, DumpRow } from "@/lib/mind-data";
import { cn } from "@/lib/utils";

import { deleteBrainDump } from "../actions";
import { CardTools } from "@/components/panel-shared";

const PAGE_SIZE = 8;

const KIND_ICON = { EMPTY: Sunrise, TOMORROW: MoonStar } as const;

/**
 * Brain dump: the balloon as the days have kept it, a way to start (what
 * to write, for how long, or done on paper), and the dumps so far, folded.
 */
export function BrainDumpPanel({
  view,
  onBegin,
  onPaper,
  onOpen,
}: {
  view: BrainDumpView;
  onBegin: (kind: DumpKind, minutes: DumpMinutes) => void;
  onPaper: (kind: DumpKind) => void;
  onOpen: (row: DumpRow) => void;
}) {
  const [kind, setKind] = useState<DumpKind>(() => suggestedKind(view.minuteOfDay));
  const [minutes, setMinutes] = useState<DumpMinutes>(5);
  const [shown, setShown] = useState(PAGE_SIZE);
  const late = isBedtime(view.minuteOfDay);

  return (
    <div className="space-y-12">
      <SceneCard tab="braindump" tending={view.tending} note={(day) => view.notes[day.dateISO] ?? null} />

      <GuideCard guide="braindump" firstTime={view.dumps.length === 0} />

      <section
        aria-labelledby="dump-start"
        className="dump-sky relative isolate overflow-hidden rounded-3xl px-5 py-6 text-[var(--woop-ink)] shadow-[0_24px_60px_-34px_rgba(40,30,90,0.55)] ring-1 ring-[var(--woop-glass-edge)] sm:px-8 sm:py-8"
      >
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-1">
            <h2 id="dump-start" className="font-display text-title">
              Empty your head
            </h2>
            <InfoTip term="braindump" />
          </div>
          <p className="text-body text-[var(--woop-ink-muted)]">
            Write whatever is in there for a few minutes. Don&apos;t sort it or judge it, and stop when the timer ends.
          </p>
        </div>

        <div role="radiogroup" aria-label="What to write" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["EMPTY", "TOMORROW"] as const).map((value) => {
            const Icon = KIND_ICON[value];
            const on = kind === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(value)}
                className={cn(
                  "group/kind flex items-start gap-3 rounded-2xl border p-4 text-left transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none active:scale-[0.99]",
                  on
                    ? "border-[var(--woop-ink)]/25 bg-[var(--woop-solid)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] hover:bg-[var(--woop-solid)]/70",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
                    on
                      ? "border-transparent bg-[var(--woop-ink)] text-[var(--woop-on-ink)]"
                      : "border-[var(--woop-glass-edge)] text-[var(--woop-ink-muted)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">{DUMP_COPY[value].name}</span>
                  <span className="block text-sm text-[var(--woop-ink-muted)]">{DUMP_COPY[value].hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {late && kind === "EMPTY" && (
          <p className="mt-3 text-sm text-[var(--woop-ink-muted)]">
            It&apos;s late. Heavy worries are better earlier in the evening; this close to bed, a list for tomorrow settles
            you better.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="How long"
            className="inline-flex rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] p-1"
          >
            {DUMP_MINUTES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={minutes === value}
                onClick={() => setMinutes(value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none",
                  minutes === value
                    ? "bg-[var(--woop-solid)] text-[var(--woop-ink)] shadow-sm"
                    : "text-[var(--woop-ink-muted)] hover:text-[var(--woop-ink)]",
                )}
              >
                {value} min
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => onBegin(kind, minutes)} className={cn(ritualPrimaryClass, "px-6")}>
            Begin
          </Button>
          <Button type="button" variant="ghost" onClick={() => onPaper(kind)} className={cn(ritualGhostClass, "rounded-full")}>
            <PenLine className="size-4" aria-hidden />
            I did it on paper
          </Button>
        </div>

      </section>

      {view.dumps.length > 0 && (
        <section aria-labelledby="dump-folded" className="space-y-4">
          <div className="space-y-0.5">
            <h3 id="dump-folded" className="text-body font-medium">
              Folded away
            </h3>
            <p className="text-label text-muted-foreground">Each one opens the day after it was written.</p>
          </div>
          {/* A row to swipe through on a phone, a grid from there up. */}
          <ol className="dump-scroll -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pt-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pt-0 sm:pb-0 lg:grid-cols-4">
            {view.dumps.slice(0, shown).map((row) => (
              <li key={row.id} className="group relative w-[72%] max-w-72 shrink-0 snap-start sm:w-auto sm:max-w-none">
                <DumpEnvelope row={row} onOpen={onOpen} />
                <CardTools
                  label={`the dump from ${row.dateLabel} at ${row.time}`}
                  items={[]}
                  deleteTitle="Delete this dump?"
                  deleteDescription="It's gone for good. If it was the day's only one, that day no longer counts for the balloon. Tasks it sent stay on your list."
                  onDelete={() => deleteBrainDump(row.id)}
                  className="top-1.5 right-1.5 [&_button]:size-7"
                />
              </li>
            ))}
          </ol>
          {view.dumps.length > shown && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show older
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
