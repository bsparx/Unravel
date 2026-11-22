"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Compass,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExcludedItems } from "@/components/use-stats-selection";
import { formatDuration } from "@/lib/dates";
import {
  ENDING_SUMMARY_MAX_CHARS,
  computeEndingSummaryComparison,
  formatDeltaDuration,
  formatDeltaPercent,
  incompleteTodayItems,
  type EndingSummaryDaySlice,
} from "@/lib/ending-summary";
import {
  filterSelectedIds,
  type MissedHabitNote,
  type TrackableItem,
} from "@/lib/stats-summary";
import { cn } from "@/lib/utils";

import { bailOut, saveEndingSummary } from "../actions";
import { CloseStepNav } from "./close-chrome";
import { OpenHabitsCard } from "./open-habits-card";

export function StepEndingSummary({
  todayISO,
  todayLabel,
  items,
  days,
  initial,
  alreadySaved,
}: {
  todayISO: string;
  todayLabel: string;
  items: readonly TrackableItem[];
  days: readonly EndingSummaryDaySlice[];
  initial: {
    keepDoing: string;
    tryTomorrow: string;
    avoid: string;
    missedNotes: MissedHabitNote[];
  };
  alreadySaved: boolean;
}) {
  const { excludedSet } = useExcludedItems();
  const initialMissedNotes = initial.missedNotes;

  const [missedReasons, setMissedReasons] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      for (const note of initialMissedNotes) {
        map[note.itemId] = note.reason;
      }
      return map;
    },
  );

  const selectedIds = useMemo(
    () => filterSelectedIds(items, excludedSet),
    [items, excludedSet],
  );

  const comparison = useMemo(
    () => computeEndingSummaryComparison(days, selectedIds, todayISO),
    [days, selectedIds, todayISO],
  );

  const todayRecord = useMemo(
    () => days.find((day) => day.iso === todayISO) ?? null,
    [days, todayISO],
  );

  const openItems = useMemo(
    () => incompleteTodayItems(items, todayRecord, selectedIds),
    [items, todayRecord, selectedIds],
  );

  // Build the serialized missed-notes payload from open items (plus any
  // previously noted item whose reason is still non-empty).
  const serializedMissedNotes = useMemo(() => {
    const titleById = new Map<string, string>();
    for (const item of items) titleById.set(item.id, item.title);
    for (const note of initialMissedNotes) {
      if (!titleById.has(note.itemId)) titleById.set(note.itemId, note.title);
    }

    const openIdSet = new Set(openItems.map(({ item }) => item.id));
    const list: MissedHabitNote[] = [];

    for (const { item } of openItems) {
      const reason = (missedReasons[item.id] ?? "").trim();
      if (reason) list.push({ itemId: item.id, title: item.title, reason });
    }
    // Preserve notes on items that weren't in `openItems` only if already saved
    // and still non-empty — unless the user went back and completed them today!
    for (const note of initialMissedNotes) {
      if (openIdSet.has(note.itemId)) continue;
      const status = todayRecord?.items[note.itemId]?.status;
      if (status === "done" || status === "bonus") continue;
      const reason = (missedReasons[note.itemId] ?? "").trim();
      if (reason) {
        list.push({
          itemId: note.itemId,
          title: titleById.get(note.itemId) ?? note.title,
          reason,
        });
      }
    }
    return JSON.stringify(list);
  }, [items, initialMissedNotes, openItems, missedReasons, todayRecord]);

  const { today, monthAvg, weekdayAvg, deltas } = comparison;
  const hasBaseline = monthAvg.sampleDays > 0 || weekdayAvg.sampleDays > 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div className="animate-rise">
        <CloseStepNav
          current="summary"
          includeSummary={true}
          dateLabel={todayLabel}
        />

        <header className="mb-7 px-1">
          <h1 className="font-display text-display text-balance">
            How today went
          </h1>
          <p className="text-muted-foreground mt-1.5 text-label">
            A calm look at your day before setting it down. Everything here is
            optional — saving marks today&apos;s ending summary habit done.
          </p>
        </header>
      </div>

      {/* 1. Today vs Monthly avg & Same-weekday avg */}
      <section
        aria-label="Today's statistics compared to your averages"
        className="animate-rise mb-5 grid gap-4 [animation-delay:45ms] sm:grid-cols-2"
      >
        {/* Habits card */}
        <div className="bg-card rounded-[24px] border border-[var(--card-edge)] p-5 shadow-[var(--card-shadow)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-label font-medium">
              <CheckCircle2 className="text-flow size-4" aria-hidden />
              Habits &amp; practices
            </span>
            {today.habitsPercent !== null && (
              <span
                className={cn(
                  "font-mono text-micro font-semibold tabular-nums",
                  today.habitsPercent >= 80
                    ? "text-flow"
                    : "text-muted-foreground",
                )}
              >
                {today.habitsPercent}%
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-baseline gap-2.5">
            <p
              className={cn(
                "font-mono text-display leading-none tracking-tight tabular-nums",
                today.habitsActive > 0 && today.habitsDone === today.habitsActive
                  ? "text-flow"
                  : "text-foreground",
              )}
            >
              {today.habitsActive > 0
                ? `${today.habitsDone}/${today.habitsActive}`
                : "—"}
            </p>
            <span className="text-muted-foreground text-label">
              {today.habitsActive > 0 ? "completed" : "none scheduled"}
            </span>
          </div>

          <div className="bg-muted mt-3.5 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                today.habitsPercent !== null && today.habitsPercent >= 80
                  ? "bg-flow"
                  : "bg-primary",
              )}
              style={{ width: `${today.habitsPercent ?? 0}%` }}
            />
          </div>

          <div className="border-border/50 mt-4 space-y-2 border-t pt-3.5">
            <ComparisonRow
              label="Monthly avg"
              value={
                monthAvg.avgHabitsPercent !== null
                  ? `${monthAvg.avgHabitsPercent}%${monthAvg.avgHabitsDone !== null ? ` (${monthAvg.avgHabitsDone}/day)` : ""}`
                  : "No baseline yet"
              }
              delta={
                deltas.vsMonthPercent !== null
                  ? formatDeltaPercent(deltas.vsMonthPercent)
                  : null
              }
              positive={
                deltas.vsMonthPercent !== null && deltas.vsMonthPercent > 0
              }
              negative={
                deltas.vsMonthPercent !== null && deltas.vsMonthPercent < 0
              }
            />
            <ComparisonRow
              label={`${today.weekdayName} avg`}
              value={
                weekdayAvg.avgHabitsPercent !== null
                  ? `${weekdayAvg.avgHabitsPercent}%${weekdayAvg.avgHabitsDone !== null ? ` (${weekdayAvg.avgHabitsDone}/day)` : ""}`
                  : "No baseline yet"
              }
              delta={
                deltas.vsWeekdayPercent !== null
                  ? formatDeltaPercent(deltas.vsWeekdayPercent)
                  : null
              }
              positive={
                deltas.vsWeekdayPercent !== null && deltas.vsWeekdayPercent > 0
              }
              negative={
                deltas.vsWeekdayPercent !== null && deltas.vsWeekdayPercent < 0
              }
            />
          </div>
        </div>

        {/* Productive hours card */}
        <div className="bg-card rounded-[24px] border border-[var(--card-edge)] p-5 shadow-[var(--card-shadow)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-label font-medium">
              <Clock className="text-running size-4" aria-hidden />
              Time put in
            </span>
            {today.practiceSeconds > 0 && (
              <span className="text-muted-foreground font-mono text-micro tabular-nums">
                incl. {formatDuration(today.practiceSeconds)} mind/heart
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-baseline gap-2.5">
            <p
              className={cn(
                "font-mono text-display leading-none tracking-tight tabular-nums",
                today.productiveSeconds > 0
                  ? "text-running"
                  : "text-muted-foreground",
              )}
            >
              {today.productiveSeconds > 0
                ? formatDuration(today.productiveSeconds)
                : "0m"}
            </p>
            <span className="text-muted-foreground text-label">productive</span>
          </div>

          <p className="text-muted-foreground mt-3.5 text-micro">
            {hasBaseline
              ? `Compared across ${monthAvg.sampleDays} recent ${monthAvg.sampleDays === 1 ? "day" : "days"}${weekdayAvg.sampleDays > 0 ? ` and ${weekdayAvg.sampleDays} ${today.weekdayName}${weekdayAvg.sampleDays === 1 ? "" : "s"}` : ""}.`
              : "Averages will appear once a few past days are logged."}
          </p>

          <div className="border-border/50 mt-4 space-y-2 border-t pt-3.5">
            <ComparisonRow
              label="Monthly avg"
              value={
                monthAvg.sampleDays > 0
                  ? monthAvg.avgProductiveSeconds > 0
                    ? formatDuration(monthAvg.avgProductiveSeconds)
                    : "0m"
                  : "No baseline yet"
              }
              delta={
                deltas.vsMonthSeconds !== null
                  ? formatDeltaDuration(deltas.vsMonthSeconds)
                  : null
              }
              positive={
                deltas.vsMonthSeconds !== null && deltas.vsMonthSeconds >= 60
              }
              negative={
                deltas.vsMonthSeconds !== null && deltas.vsMonthSeconds <= -60
              }
            />
            <ComparisonRow
              label={`${today.weekdayName} avg`}
              value={
                weekdayAvg.sampleDays > 0
                  ? weekdayAvg.avgProductiveSeconds > 0
                    ? formatDuration(weekdayAvg.avgProductiveSeconds)
                    : "0m"
                  : "No baseline yet"
              }
              delta={
                deltas.vsWeekdaySeconds !== null
                  ? formatDeltaDuration(deltas.vsWeekdaySeconds)
                  : null
              }
              positive={
                deltas.vsWeekdaySeconds !== null &&
                deltas.vsWeekdaySeconds >= 60
              }
              negative={
                deltas.vsWeekdaySeconds !== null &&
                deltas.vsWeekdaySeconds <= -60
              }
            />
          </div>
        </div>
      </section>

      {/* 2. Still open today — go back to complete, or note why it slipped */}
      {today.habitsActive > 0 && (
        <OpenHabitsCard
          openItems={openItems}
          reasonsByItemId={missedReasons}
          onChangeReason={(itemId, reason) =>
            setMissedReasons((prev) => ({ ...prev, [itemId]: reason }))
          }
          className="animate-rise mb-5 [animation-delay:80ms]"
        />
      )}

      {/* 3. Optional reflections form */}
      <section
        aria-label="Reflection prompts"
        className="bg-card animate-rise rounded-[26px] border border-[var(--card-edge)] p-5 shadow-[var(--card-shadow)] [animation-delay:110ms] sm:p-7"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-title font-medium">
              Notes for tomorrow
            </h2>
            <p className="text-muted-foreground mt-0.5 text-label">
              Saved in Statistics and shown gently on Today and Day tomorrow.
            </p>
          </div>
          <span className="border-border/70 bg-muted/50 text-muted-foreground rounded-full border px-2.5 py-0.5 text-micro font-medium">
            All optional
          </span>
        </div>

        <form action={saveEndingSummary} className="space-y-5">
          <input type="hidden" name="habitsDone" value={today.habitsDone} />
          <input type="hidden" name="habitsTotal" value={today.habitsActive} />
          <input
            type="hidden"
            name="productiveSeconds"
            value={today.productiveSeconds}
          />
          <input
            type="hidden"
            name="missedNotes"
            value={serializedMissedNotes}
          />

          <div className="space-y-2">
            <Label
              htmlFor="ending-keep-doing"
              className="flex items-center gap-2 text-label font-medium"
            >
              <BookmarkCheck className="text-flow size-4 shrink-0" aria-hidden />
              <span>Remember &amp; focus on again</span>
            </Label>
            <Textarea
              id="ending-keep-doing"
              name="keepDoing"
              rows={2}
              maxLength={ENDING_SUMMARY_MAX_CHARS}
              defaultValue={initial.keepDoing}
              placeholder="What worked well today that you want to keep doing?"
              className="resize-y rounded-xl text-body"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="ending-try-tomorrow"
              className="flex items-center gap-2 text-label font-medium"
            >
              <Compass className="text-primary size-4 shrink-0" aria-hidden />
              <span>Try tomorrow</span>
            </Label>
            <Textarea
              id="ending-try-tomorrow"
              name="tryTomorrow"
              rows={2}
              maxLength={ENDING_SUMMARY_MAX_CHARS}
              defaultValue={initial.tryTomorrow}
              placeholder="One small tweak or experiment to improve tomorrow's routine…"
              className="resize-y rounded-xl text-body"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="ending-avoid"
              className="flex items-center gap-2 text-label font-medium"
            >
              <ShieldAlert
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
              <span>Avoid</span>
            </Label>
            <Textarea
              id="ending-avoid"
              name="avoid"
              rows={2}
              maxLength={ENDING_SUMMARY_MAX_CHARS}
              defaultValue={initial.avoid}
              placeholder="Any distraction, friction, or trap you want to steer clear of…"
              className="resize-y rounded-xl text-body"
            />
          </div>

          <div className="border-border/50 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Button type="submit" size="lg" className="min-h-11 rounded-xl px-5">
              <span>{alreadySaved ? "Update & continue" : "Save & continue"}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Button>

            <Link
              href="/close?step=one-thing"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-2 text-label underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              Skip for tonight
            </Link>
          </div>
        </form>
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

function ComparisonRow({
  label,
  value,
  delta,
  positive,
  negative,
}: {
  label: string;
  value: string;
  delta: string | null;
  positive: boolean;
  negative: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-micro">
      <span className="text-muted-foreground truncate">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-foreground/85 tabular-nums">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums",
              positive
                ? "bg-flow-muted text-flow"
                : negative
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted/60 text-muted-foreground",
            )}
          >
            {positive && <TrendingUp className="size-3" aria-hidden />}
            {negative && <TrendingDown className="size-3" aria-hidden />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
