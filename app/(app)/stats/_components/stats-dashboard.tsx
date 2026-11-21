"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  HandHeart,
  List,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDuration } from "@/lib/dates";
import {
  calendarWeeks,
  completionLevel,
  filterSelectedIds,
  orderedWeekdayLabels,
  summarizeDay,
  summarizeRange,
  type StatsDayRecord,
  type StatsOverview,
  type TrackableGroup,
  type TrackableItem,
} from "@/lib/stats-summary";
import { cn } from "@/lib/utils";

import { DayDetailSheet } from "./day-detail-sheet";

// ---------------------------------------------------------------- selection store

const STORAGE_KEY = "unravel-stats-excluded";
const EMPTY_EXCLUDED: readonly string[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedParsed: readonly string[] = EMPTY_EXCLUDED;

function readExcluded(): readonly string[] {
  if (typeof window === "undefined") return EMPTY_EXCLUDED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_EXCLUDED;
      return cachedParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    cachedParsed = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : EMPTY_EXCLUDED;
    return cachedParsed;
  } catch {
    return EMPTY_EXCLUDED;
  }
}

function writeExcluded(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  const raw = JSON.stringify(unique);
  cachedRaw = raw;
  cachedParsed = unique;
  try {
    if (unique.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage unavailable — selection still updates in memory for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribeExcluded(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useExcludedItems() {
  const excludedList = useSyncExternalStore(
    subscribeExcluded,
    readExcluded,
    () => EMPTY_EXCLUDED,
  );
  const excludedSet = useMemo(() => new Set(excludedList), [excludedList]);

  const toggleItem = (id: string) => {
    const next = new Set(excludedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeExcluded([...next]);
  };

  const setGroupIncluded = (ids: string[], include: boolean) => {
    const next = new Set(excludedSet);
    for (const id of ids) {
      if (include) next.delete(id);
      else next.add(id);
    }
    writeExcluded([...next]);
  };

  const resetAll = () => writeExcluded([]);

  return { excludedSet, toggleItem, setGroupIncluded, resetAll };
}

// ---------------------------------------------------------------- dashboard

export function StatsDashboard({ data }: { data: StatsOverview }) {
  const { excludedSet, toggleItem, setGroupIncluded, resetAll } =
    useExcludedItems();
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const selectedIds = useMemo(
    () => filterSelectedIds(data.items, excludedSet),
    [data.items, excludedSet],
  );

  const rangeSummary = useMemo(
    () => summarizeRange(data.days, selectedIds),
    [data.days, selectedIds],
  );

  const daySummaries = useMemo(
    () =>
      new Map(
        data.days.map((day) => [day.iso, summarizeDay(day, selectedIds)]),
      ),
    [data.days, selectedIds],
  );

  const weeks = useMemo(
    () => calendarWeeks(data.days, data.weekStart),
    [data.days, data.weekStart],
  );

  const weekdayLabels = useMemo(
    () => orderedWeekdayLabels(data.weekStart),
    [data.weekStart],
  );

  const daysNewestFirst = useMemo(() => [...data.days].reverse(), [data.days]);

  const selectedIndex = selectedISO
    ? data.days.findIndex((day) => day.iso === selectedISO)
    : -1;
  const selectedDay = selectedIndex >= 0 ? data.days[selectedIndex] : null;

  const isFiltered = selectedIds.size < data.items.length;

  const prevHref = `/stats?end=${data.prevEndISO}`;
  const nextHref =
    data.nextEndISO === null
      ? null
      : data.nextEndISO === "latest"
        ? "/stats"
        : `/stats?end=${data.nextEndISO}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-10">
      {/* Header + filter */}
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-display">Statistics</h1>
          <p className="mt-1 text-label text-muted-foreground">
            {data.isLatest
              ? "Last 2 weeks of habits, mind & heart, and productive time."
              : `${data.windowLabel} — tap any day for details.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!data.isLatest && (
            <Button
              asChild
              variant="outline"
              className="min-h-11 rounded-[13px] border-border/70 bg-card/80 px-3.5"
            >
              <Link href="/stats">Last 2 weeks</Link>
            </Button>
          )}

          {data.items.length > 0 && (
            <ItemSelectorPopover
              items={data.items}
              selectedIds={selectedIds}
              isFiltered={isFiltered}
              onToggle={toggleItem}
              onSetGroup={setGroupIncluded}
              onReset={resetAll}
            />
          )}
        </div>
      </header>

      {/* Two-card Hero Summary */}
      <section className="animate-rise mb-6 grid gap-4 sm:grid-cols-2">
        {/* Card 1: Habits + Mind & Heart kept */}
        <div className="rounded-[22px] border border-[var(--card-edge)] bg-card p-5 shadow-[var(--card-shadow)] sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-label font-medium text-muted-foreground">
              <CheckCircle2 className="size-4 text-flow" aria-hidden />
              Habits &amp; practices
            </span>
            {data.items.length > 0 && (
              <span className="font-mono text-micro text-muted-foreground tabular-nums">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="mt-2.5 flex items-baseline gap-3">
            <p
              className={cn(
                "font-mono text-display leading-none tracking-tight tabular-nums",
                rangeSummary.percent !== null && rangeSummary.percent >= 80
                  ? "text-flow"
                  : "text-foreground",
              )}
            >
              {rangeSummary.percent !== null
                ? `${rangeSummary.percent}%`
                : "—"}
            </p>
            {rangeSummary.active > 0 && (
              <span className="font-mono text-title text-muted-foreground tabular-nums">
                {rangeSummary.done} / {rangeSummary.active}
              </span>
            )}
          </div>

          <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                rangeSummary.percent !== null && rangeSummary.percent >= 80
                  ? "bg-flow"
                  : "bg-primary",
              )}
              style={{ width: `${rangeSummary.percent ?? 0}%` }}
            />
          </div>

          <p className="mt-2.5 text-micro text-muted-foreground">
            {selectedIds.size === 0 ? (
              "Select habits or practices above to track them here."
            ) : rangeSummary.active === 0 ? (
              "No selected habits were active in these two weeks."
            ) : (
              <>
                {data.isLatest && rangeSummary.todayActive > 0 && (
                  <>
                    Today{" "}
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {rangeSummary.todayDone}/{rangeSummary.todayActive}
                    </span>
                    {" · "}
                  </>
                )}
                {rangeSummary.perfectDays} full{" "}
                {rangeSummary.perfectDays === 1 ? "day" : "days"}
                {" · "}off-days not deducted
              </>
            )}
          </p>
        </div>

        {/* Card 2: Productive time */}
        <div className="rounded-[22px] border border-[var(--card-edge)] bg-card p-5 shadow-[var(--card-shadow)] sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-label font-medium text-muted-foreground">
              <Clock className="size-4 text-running" aria-hidden />
              Productive time
            </span>
            <span className="font-mono text-micro text-muted-foreground tabular-nums">
              {rangeSummary.activeTimeDays}{" "}
              {rangeSummary.activeTimeDays === 1 ? "day" : "days"} tracked
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline gap-3">
            <p className="font-mono text-display leading-none tracking-tight text-running tabular-nums">
              {rangeSummary.totalProductiveSeconds > 0
                ? formatDuration(rangeSummary.totalProductiveSeconds)
                : "0m"}
            </p>
          </div>

          <p className="mt-4 text-label text-muted-foreground">
            {rangeSummary.totalProductiveSeconds === 0 ? (
              data.isLatest
                ? "Run a timer or log time on any task to see it here."
                : "No productive time was tracked during these two weeks."
            ) : (
              <>
                {data.isLatest && (
                  <>
                    Today{" "}
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {rangeSummary.todayProductiveSeconds > 0
                        ? formatDuration(rangeSummary.todayProductiveSeconds)
                        : "0m"}
                    </span>
                    {rangeSummary.avgProductiveSeconds > 0 && " · "}
                  </>
                )}
                {rangeSummary.avgProductiveSeconds > 0 && (
                  <>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatDuration(rangeSummary.avgProductiveSeconds)}
                    </span>{" "}
                    avg per tracked day
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </section>

      {/* Main 2-Week Overview Stage */}
      <section
        className="animate-rise rounded-[26px] border border-[var(--card-edge)] bg-card p-5 shadow-[var(--card-shadow)] sm:p-7"
        style={{ animationDelay: "50ms" }}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] leading-tight font-medium">
              {data.isLatest ? "Last 2 weeks" : data.windowLabel}
            </h2>
            <p className="mt-0.5 text-label text-muted-foreground">
              {data.isLatest ? `${data.windowLabel} · ` : ""}Tap any day for
              details.
            </p>
          </div>

          <div
            role="group"
            aria-label="Layout"
            className="inline-flex items-center gap-1 rounded-[12px] border border-border/70 bg-muted/45 p-1"
          >
            <button
              type="button"
              aria-pressed={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                viewMode === "calendar"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-3 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" aria-hidden />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* CALENDAR VIEW — 2 tidy weeks aligned to user.weekStart */}
        {viewMode === "calendar" ? (
          <div className="space-y-5">
            <div>
              <div className="mb-2 grid grid-cols-7 gap-1.5 text-center sm:gap-2.5">
                {weekdayLabels.map((label) => (
                  <span
                    key={label}
                    className="text-micro font-medium text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="space-y-1.5 sm:space-y-2.5">
                {weeks.map((week, wIdx) => (
                  <div
                    key={wIdx}
                    className="grid grid-cols-7 gap-1.5 sm:gap-2.5"
                  >
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`pad-${wIdx}-${dIdx}`}
                            className="min-h-12 sm:min-h-[112px]"
                            aria-hidden
                          />
                        );
                      }
                      const s = daySummaries.get(day.iso)!;
                      const level = completionLevel(s.done, s.active);
                      const showMonth =
                        day.dayNumber === 1 || day.iso === data.days[0].iso;

                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => setSelectedISO(day.iso)}
                          aria-label={`${day.fullLabel}: ${
                            s.active > 0
                              ? `${s.done} of ${s.active} done`
                              : "no habits active"
                          }, ${
                            day.productiveSeconds > 0
                              ? `${formatDuration(day.productiveSeconds)} productive`
                              : "no productive time"
                          }`}
                          className={cn(
                            "group relative flex min-h-12 flex-col justify-between rounded-xl border p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-h-[112px] sm:rounded-2xl sm:p-3",
                            tileToneClass(level, day.isToday),
                          )}
                        >
                          {/* Top row: date */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "font-mono text-micro tabular-nums",
                                day.isToday
                                  ? "font-semibold text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {day.dayNumber}
                              {showMonth && (
                                <span className="ml-1 hidden font-sans sm:inline">
                                  {day.monthShort}
                                </span>
                              )}
                            </span>
                            {day.isToday && (
                              <span
                                className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground max-sm:hidden"
                              >
                                Today
                              </span>
                            )}
                            {day.isToday && (
                              <span
                                className="size-1.5 rounded-full bg-primary sm:hidden"
                                aria-hidden
                              />
                            )}
                          </div>

                          {/* Middle: done/active + slim bar */}
                          <div className="mt-1 sm:mt-2">
                            <span
                              className={cn(
                                "block font-mono text-micro font-semibold tabular-nums sm:text-title",
                                level === "full"
                                  ? "text-flow"
                                  : level === "none" || level === "empty"
                                    ? "text-muted-foreground/75"
                                    : "text-foreground",
                              )}
                            >
                              {s.active > 0 ? `${s.done}/${s.active}` : "—"}
                            </span>

                            <div className="mt-1.5 hidden h-1.5 w-full overflow-hidden rounded-full bg-background/55 sm:block">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  level === "full" ? "bg-flow" : "bg-primary",
                                )}
                                style={{ width: `${s.percent ?? 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Bottom: productive time */}
                          <span
                            className={cn(
                              "mt-2 hidden font-mono text-micro leading-none tabular-nums sm:block",
                              day.productiveSeconds > 0
                                ? "font-medium text-running"
                                : "text-muted-foreground/55",
                            )}
                          >
                            {day.productiveSeconds > 0
                              ? formatDuration(day.productiveSeconds)
                              : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <CompletionLegend />

            {/* On phones, show the clean 14-day rows right below the compact grid */}
            <div className="border-t border-border/50 pt-4 sm:hidden">
              <DayRowsList
                days={daysNewestFirst}
                daySummaries={daySummaries}
                onSelect={setSelectedISO}
              />
            </div>
          </div>
        ) : (
          /* LIST VIEW — all 14 days, newest first */
          <DayRowsList
            days={daysNewestFirst}
            daySummaries={daySummaries}
            onSelect={setSelectedISO}
          />
        )}

        {/* Explicit window navigation links (Previous 2 weeks / Next 2 weeks) */}
        <nav
          aria-label="Browse earlier weeks"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-5"
        >
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Link href={prevHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Previous 2 weeks
            </Link>
          </Button>

          <span className="font-mono text-micro text-muted-foreground tabular-nums">
            {data.windowLabel}
          </span>

          {nextHref ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-mr-2 rounded-xl text-foreground hover:bg-muted"
            >
              <Link href={nextHref}>
                {data.nextEndISO === "latest"
                  ? "Last 2 weeks"
                  : "Next 2 weeks"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="w-28 max-sm:hidden" aria-hidden />
          )}
        </nav>
      </section>

      {/* Quiet footer link to deeper per-habit streaks & charts */}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1 text-label text-muted-foreground">
        <span>Off-days for a habit are never deducted from that day.</span>
        <Link
          href="/habits/stats"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          Habit trends
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </footer>

      {/* Day Details Sheet */}
      <DayDetailSheet
        day={selectedDay}
        items={data.items}
        selectedIds={selectedIds}
        canPrev={selectedIndex > 0}
        canNext={selectedIndex >= 0 && selectedIndex < data.days.length - 1}
        onPrev={() => {
          if (selectedIndex > 0) setSelectedISO(data.days[selectedIndex - 1].iso);
        }}
        onNext={() => {
          if (selectedIndex >= 0 && selectedIndex < data.days.length - 1) {
            setSelectedISO(data.days[selectedIndex + 1].iso);
          }
        }}
        onClose={() => setSelectedISO(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- subcomponents

function DayRowsList({
  days,
  daySummaries,
  onSelect,
}: {
  days: readonly StatsDayRecord[];
  daySummaries: Map<string, ReturnType<typeof summarizeDay>>;
  onSelect: (iso: string) => void;
}) {
  return (
    <ul className="divide-y divide-border/50">
      {days.map((day) => {
        const s = daySummaries.get(day.iso)!;
        const level = completionLevel(s.done, s.active);

        return (
          <li key={day.iso}>
            <button
              type="button"
              onClick={() => onSelect(day.iso)}
              className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3"
            >
              {/* Date */}
              <div className="min-w-28 shrink-0">
                <p className="text-label font-medium text-foreground">
                  {day.isToday
                    ? "Today"
                    : day.isYesterday
                      ? "Yesterday"
                      : day.shortLabel}
                </p>
                {(day.isToday || day.isYesterday) && (
                  <p className="text-micro text-muted-foreground">
                    {day.shortLabel}
                  </p>
                )}
              </div>

              {/* Habits & practices progress */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {s.active > 0 ? (
                  <>
                    <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          level === "full" ? "bg-flow" : "bg-primary",
                        )}
                        style={{ width: `${s.percent ?? 0}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "inline-flex min-w-14 items-center justify-center rounded-full border px-2.5 py-0.5 font-mono text-micro font-semibold tabular-nums",
                        level === "full"
                          ? "border-flow/35 bg-flow-muted text-flow"
                          : s.done > 0
                            ? "border-border/70 bg-muted/50 text-foreground"
                            : "border-border/50 bg-transparent text-muted-foreground",
                      )}
                    >
                      {s.done} / {s.active}
                    </span>
                  </>
                ) : (
                  <span className="text-micro text-muted-foreground">
                    No habits active
                  </span>
                )}
              </div>

              {/* Productive time + chevron */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "min-w-14 text-right font-mono text-label tabular-nums",
                    day.productiveSeconds > 0
                      ? "font-medium text-running"
                      : "text-muted-foreground/60",
                  )}
                >
                  {day.productiveSeconds > 0
                    ? formatDuration(day.productiveSeconds)
                    : "—"}
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CompletionLegend() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-micro text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border border-border/60 bg-muted/40" />
        0%
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border border-primary/25 bg-primary/20" />
        Some
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border border-primary/45 bg-primary/45" />
        Most
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] border border-flow/45 bg-flow-muted" />
        All done
      </span>
    </div>
  );
}

function ItemSelectorPopover({
  items,
  selectedIds,
  isFiltered,
  onToggle,
  onSetGroup,
  onReset,
}: {
  items: readonly TrackableItem[];
  selectedIds: ReadonlySet<string>;
  isFiltered: boolean;
  onToggle: (id: string) => void;
  onSetGroup: (ids: string[], include: boolean) => void;
  onReset: () => void;
}) {
  const groups: {
    key: TrackableGroup;
    label: string;
    icon: typeof Repeat;
    items: TrackableItem[];
  }[] = (
    [
      {
        key: "habit" as const,
        label: "Habits",
        icon: Repeat,
        items: items.filter((item) => item.group === "habit"),
      },
      {
        key: "mind" as const,
        label: "Mind",
        icon: Brain,
        items: items.filter((item) => item.group === "mind"),
      },
      {
        key: "heart" as const,
        label: "Heart",
        icon: HandHeart,
        items: items.filter((item) => item.group === "heart"),
      },
    ] satisfies {
      key: TrackableGroup;
      label: string;
      icon: typeof Repeat;
      items: TrackableItem[];
    }[]
  ).filter((g) => g.items.length > 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-h-11 rounded-[13px] border-border/70 bg-card/80 px-3.5",
            isFiltered && "border-primary/45 bg-accent/60 text-accent-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          <span>
            {isFiltered
              ? `${selectedIds.size} of ${items.length}`
              : `All ${items.length}`}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-label font-semibold text-foreground">
              Included in statistics
            </p>
            <p className="text-micro text-muted-foreground">
              Choose which habits and practices count.
            </p>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-micro font-medium text-accent-foreground hover:bg-accent"
            >
              <RotateCcw className="size-3" aria-hidden />
              All
            </button>
          )}
        </div>

        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => {
            const Icon = group.icon;
            const groupIds = group.items.map((item) => item.id);
            const allSelected = groupIds.every((id) => selectedIds.has(id));

            return (
              <div key={group.key} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 text-micro font-semibold text-muted-foreground">
                    <Icon className="size-3" aria-hidden />
                    {group.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetGroup(groupIds, !allSelected)}
                    className="text-micro text-muted-foreground hover:text-foreground"
                  >
                    {allSelected ? "Hide all" : "Show all"}
                  </button>
                </div>

                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => onToggle(item.id)}
                          className={cn(
                            "flex min-h-10 w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            checked
                              ? "bg-muted/60 text-foreground"
                              : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={cn(
                                "grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background/50",
                              )}
                              aria-hidden
                            >
                              {checked && <Check className="size-3 stroke-[2.5]" />}
                            </span>
                            <span className="truncate text-label font-medium">
                              {item.title}
                            </span>
                          </span>
                          {item.group === "habit" && (
                            <span className="shrink-0 text-micro text-muted-foreground">
                              {item.scheduleLabel}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- tile tones

function tileToneClass(
  level: ReturnType<typeof completionLevel>,
  isToday: boolean,
): string {
  const todayRing = isToday ? "ring-2 ring-primary/40" : "";
  switch (level) {
    case "full":
      return cn(
        "border-flow/35 bg-flow-muted/55 hover:border-flow/55 hover:bg-flow-muted/80",
        todayRing,
      );
    case "high":
      return cn(
        "border-primary/30 bg-primary/14 hover:border-primary/45 hover:bg-primary/20",
        todayRing,
      );
    case "mid":
      return cn(
        "border-primary/20 bg-primary/8 hover:border-primary/35 hover:bg-primary/14",
        todayRing,
      );
    case "low":
      return cn(
        "border-border/70 bg-muted/50 hover:border-border hover:bg-muted/75",
        todayRing,
      );
    case "empty":
      return cn(
        "border-border/55 bg-background/35 hover:border-border hover:bg-muted/45",
        todayRing,
      );
    case "none":
      return cn(
        "border-dashed border-border/50 bg-transparent hover:border-border hover:bg-muted/30",
        todayRing,
      );
  }
}
