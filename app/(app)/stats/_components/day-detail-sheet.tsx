"use client";

import Link from "next/link";
import {
  BookmarkCheck,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  HandHeart,
  Minus,
  Moon,
  NotebookText,
  Repeat,
  ShieldAlert,
  Sparkles,
  Sunrise,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDuration } from "@/lib/dates";
import { hasEndingSummaryNotes } from "@/lib/ending-summary";
import {
  summarizeDay,
  type DayItemEntry,
  type StatsDayRecord,
  type TrackableItem,
} from "@/lib/stats-summary";
import { MODE_LABELS } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

export function DayDetailSheet({
  day,
  items,
  selectedIds,
  endingSummaryEnabled,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
}: {
  day: StatsDayRecord | null;
  items: readonly TrackableItem[];
  selectedIds: ReadonlySet<string>;
  endingSummaryEnabled: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  if (!day) {
    return (
      <Sheet open={false} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const summary = summarizeDay(day, selectedIds);
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const firstItem = summary.firstItemId
    ? selectedItems.find((item) => item.id === summary.firstItemId) ?? null
    : null;

  const habitItems = selectedItems.filter((item) => item.group === "habit");
  const mindItems = selectedItems.filter((item) => item.group === "mind");
  const heartItems = selectedItems.filter((item) => item.group === "heart");

  const practiceTimeEntries = selectedItems
    .map((item) => ({ item, entry: day.items[item.id] }))
    .filter(
      ({ entry }) =>
        entry &&
        (entry.status === "done" || entry.status === "bonus") &&
        typeof entry.practiceSeconds === "number" &&
        entry.practiceSeconds > 0,
    );

  const productiveSubtitle =
    day.sessions.length > 0 && practiceTimeEntries.length > 0
      ? `${day.sessions.length} focus · ${practiceTimeEntries.length} ${practiceTimeEntries.length === 1 ? "practice" : "practices"}`
      : day.sessions.length > 0
        ? `${day.sessions.length} ${day.sessions.length === 1 ? "entry" : "entries"}`
        : practiceTimeEntries.length > 0
          ? `${practiceTimeEntries.length} ${practiceTimeEntries.length === 1 ? "practice" : "practices"}`
          : "Nothing tracked";

  const activeHabits = habitItems.filter((item) => {
    const status = day.items[item.id]?.status;
    return status !== "inactive" && status !== "bonus";
  });
  const bonusHabits = habitItems.filter(
    (item) => day.items[item.id]?.status === "bonus",
  );
  const inactiveHabits = habitItems.filter(
    (item) => day.items[item.id]?.status === "inactive",
  );

  const badgeLabel = day.isToday
    ? "Today"
    : day.isYesterday
      ? "Yesterday"
      : null;

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {/* Header with prev/next day gliding */}
        <SheetHeader className="border-b border-border/60 px-5 pt-5 pb-4 pr-14">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-9 rounded-lg"
                disabled={!canPrev}
                onClick={onPrev}
                aria-label="Previous day"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-9 rounded-lg"
                disabled={!canNext}
                onClick={onNext}
                aria-label="Next day"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>

            {badgeLabel && (
              <span className="rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-micro font-medium text-accent-foreground">
                {badgeLabel}
              </span>
            )}
          </div>

          <SheetTitle className="font-display mt-2 text-[24px] leading-tight font-medium">
            {day.fullLabel}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Habits, mind and heart practices, and productive time logged on{" "}
            {day.fullLabel}.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Snapshot pair */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5">
                <p className="text-micro font-medium text-muted-foreground">
                  Completed
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-mono text-heading font-semibold tabular-nums",
                      summary.active > 0 && summary.done === summary.active
                        ? "text-flow"
                        : "text-foreground",
                    )}
                  >
                    {summary.active > 0
                      ? `${summary.done}/${summary.active}`
                      : "—"}
                  </span>
                  {summary.percent !== null && (
                    <span className="font-mono text-label text-muted-foreground tabular-nums">
                      {summary.percent}%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-micro text-muted-foreground">
                  {summary.active === 0
                    ? "No items active"
                    : summary.inactive > 0
                      ? `${summary.inactive} not scheduled`
                      : "All active counted"}
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3.5">
                <p className="text-micro font-medium text-muted-foreground">
                  Productive time
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-heading font-semibold tabular-nums",
                    summary.totalProductiveSeconds > 0
                      ? "text-running"
                      : "text-muted-foreground",
                  )}
                >
                  {summary.totalProductiveSeconds > 0
                    ? formatDuration(summary.totalProductiveSeconds)
                    : "0m"}
                </p>
                <p className="mt-0.5 text-micro text-muted-foreground">
                  {productiveSubtitle}
                </p>
              </div>
            </div>

            {summary.firstTime && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/55 bg-card/60 px-3.5 py-2.5 text-label">
                <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Sunrise className="size-4 shrink-0 text-flow" aria-hidden />
                  <span className="truncate">
                    First habit
                    {firstItem && (
                      <>
                        {" · "}
                        <span className="font-medium text-foreground">
                          {firstItem.title}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-label font-semibold text-foreground tabular-nums">
                  {summary.firstTime}
                </span>
              </div>
            )}
          </div>

          {/* Ending summary report */}
          {day.endingSummary && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <SectionHeading icon={NotebookText} label="Ending summary" />
                {day.endingSummary.completedTime && (
                  <span className="font-mono text-micro text-muted-foreground tabular-nums">
                    {day.endingSummary.completedTime}
                  </span>
                )}
              </div>

              {hasEndingSummaryNotes(day.endingSummary) ? (
                <div className="space-y-2.5 rounded-2xl border border-border/60 bg-card/70 p-4">
                  {day.endingSummary.keepDoing?.trim() && (
                    <div>
                      <p className="flex items-center gap-1.5 text-micro font-semibold text-foreground/85">
                        <BookmarkCheck className="size-3.5 shrink-0 text-flow" aria-hidden />
                        Remember &amp; focus on again
                      </p>
                      <p className="mt-1 whitespace-pre-line text-label leading-relaxed text-foreground/90">
                        {day.endingSummary.keepDoing}
                      </p>
                    </div>
                  )}

                  {day.endingSummary.tryTomorrow?.trim() && (
                    <div className={day.endingSummary.keepDoing?.trim() ? "border-t border-border/50 pt-2.5" : undefined}>
                      <p className="flex items-center gap-1.5 text-micro font-semibold text-accent-foreground">
                        <Compass className="size-3.5 shrink-0" aria-hidden />
                        Try next day
                      </p>
                      <p className="mt-1 whitespace-pre-line text-label leading-relaxed text-foreground/90">
                        {day.endingSummary.tryTomorrow}
                      </p>
                    </div>
                  )}

                  {day.endingSummary.avoid?.trim() && (
                    <div
                      className={
                        day.endingSummary.keepDoing?.trim() ||
                        day.endingSummary.tryTomorrow?.trim()
                          ? "border-t border-border/50 pt-2.5"
                          : undefined
                      }
                    >
                      <p className="flex items-center gap-1.5 text-micro font-semibold text-muted-foreground">
                        <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                        Avoid
                      </p>
                      <p className="mt-1 whitespace-pre-line text-label leading-relaxed text-foreground/90">
                        {day.endingSummary.avoid}
                      </p>
                    </div>
                  )}

                  {day.endingSummary.missedNotes.length > 0 && (
                    <div
                      className={
                        day.endingSummary.keepDoing?.trim() ||
                        day.endingSummary.tryTomorrow?.trim() ||
                        day.endingSummary.avoid?.trim()
                          ? "border-t border-border/50 pt-2.5"
                          : undefined
                      }
                    >
                      <p className="flex items-center gap-1.5 text-micro font-semibold text-muted-foreground">
                        <Circle className="size-3 shrink-0" aria-hidden />
                        Why habits slipped
                      </p>
                      <ul className="mt-1.5 space-y-1.5">
                        {day.endingSummary.missedNotes.map((note) => (
                          <li
                            key={note.itemId}
                            className="text-label leading-relaxed text-foreground/90"
                          >
                            <span className="font-medium text-foreground">
                              {note.title}
                            </span>
                            <span className="text-muted-foreground"> — </span>
                            <span>{note.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-label text-muted-foreground">
                  Day reviewed on Close the day — no optional notes written.
                </p>
              )}
            </section>
          )}

          {/* Habits section */}
          {habitItems.length > 0 && (
            <section className="space-y-2.5">
              <SectionHeading icon={Repeat} label="Habits" />

              {activeHabits.length > 0 ? (
                <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-card/60">
                  {activeHabits.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      entry={day.items[item.id]}
                    />
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-label text-muted-foreground">
                  None of your selected habits were scheduled for this day.
                </p>
              )}

              {bonusHabits.length > 0 && (
                <ul className="divide-y divide-border/50 rounded-2xl border border-flow/30 bg-flow-muted/35">
                  {bonusHabits.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      entry={day.items[item.id]}
                    />
                  ))}
                </ul>
              )}

              {inactiveHabits.length > 0 && (
                <p className="px-1 text-micro leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    Not active this day (not deducted):
                  </span>{" "}
                  {inactiveHabits.map((h) => h.title).join(", ")}
                </p>
              )}
            </section>
          )}

          {/* Mind section */}
          {mindItems.length > 0 && (
            <section className="space-y-2.5">
              <SectionHeading icon={Brain} label="Mind" />
              <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-card/60">
                {mindItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    entry={day.items[item.id]}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Heart section */}
          {heartItems.length > 0 && (
            <section className="space-y-2.5">
              <SectionHeading icon={HandHeart} label="Heart" />
              <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-card/60">
                {heartItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    entry={day.items[item.id]}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* Productive time sessions + credited Mind & Heart practices */}
          <section className="space-y-2.5">
            <SectionHeading icon={Clock} label="Productive time" />

            {day.sessions.length > 0 || practiceTimeEntries.length > 0 ? (
              <ul className="divide-y divide-border/50 rounded-2xl border border-border/60 bg-card/60">
                {day.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label font-medium text-foreground">
                        {session.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-muted-foreground">
                        {session.timeLabel && (
                          <span className="font-mono tabular-nums">
                            {session.timeLabel}
                          </span>
                        )}
                        <span>
                          {session.mode === "MANUAL"
                            ? "Logged manually"
                            : MODE_LABELS[session.mode]}
                        </span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-mono text-label font-semibold text-running tabular-nums">
                        {formatDuration(session.seconds)}
                      </span>
                      {session.overtimeSeconds >= 60 && (
                        <p className="flex items-center justify-end gap-1 font-mono text-micro text-flow tabular-nums">
                          <Waves className="size-3" aria-hidden />+
                          {formatDuration(session.overtimeSeconds)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
                {practiceTimeEntries.map(({ item, entry }) => (
                  <li
                    key={`practice:${item.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro text-muted-foreground">
                        {entry.completedTime && (
                          <span className="font-mono tabular-nums">
                            {entry.completedTime}
                          </span>
                        )}
                        <span>{item.scheduleLabel}</span>
                        {entry.detail && <span>· {entry.detail}</span>}
                        {entry.practiceTimeAssumed && (
                          <span>· assumed 10m</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-mono text-label font-semibold text-running tabular-nums">
                        {formatDuration(entry.practiceSeconds ?? 0)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-label text-muted-foreground">
                No productive time tracked on this day.
              </p>
            )}

            {day.recoverySeconds > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-rest/25 bg-rest-muted/40 px-3.5 py-2.5 text-label">
                <span className="inline-flex items-center gap-2 text-rest">
                  <Moon className="size-3.5" aria-hidden />
                  Recovery logged
                </span>
                <span className="font-mono font-medium text-rest tabular-nums">
                  {formatDuration(day.recoverySeconds)}
                </span>
              </div>
            )}
          </section>

          {day.isToday && (
            <div className="flex flex-col gap-2 pt-1">
              {endingSummaryEnabled && !day.endingSummary && (
                <Button asChild className="w-full rounded-xl">
                  <Link href="/close?step=summary">
                    Write today&apos;s ending summary
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href="/day">Open today&apos;s plan</Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionHeading({
  icon: Icon,
  label,
}: {
  icon: typeof Repeat;
  label: string;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-label font-semibold text-foreground">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {label}
    </h3>
  );
}

function ItemRow({
  item,
  entry,
}: {
  item: TrackableItem;
  entry: DayItemEntry | undefined;
}) {
  const status = entry?.status ?? "missed";
  const isDone = status === "done" || status === "bonus";
  const isSkipped = status === "skipped";
  const isOpen = status === "open";
  const checkedTime = isDone ? entry?.completedTime ?? null : null;
  const creditedSeconds = isDone ? entry?.practiceSeconds ?? 0 : 0;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full",
            isDone
              ? "bg-flow text-flow-foreground"
              : isSkipped
                ? "bg-muted text-muted-foreground"
                : "border border-border/90 text-muted-foreground/50",
          )}
          aria-hidden
        >
          {status === "bonus" ? (
            <Sparkles className="size-3.5" />
          ) : isDone ? (
            <Check className="size-3.5 stroke-[2.5]" />
          ) : isSkipped ? (
            <Minus className="size-3.5" />
          ) : (
            <Circle className="size-2.5" />
          )}
        </span>

        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-label font-medium",
              isDone ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.title}
          </p>
          {isDone && (entry?.detail || status === "bonus") ? (
            <p className="truncate text-micro text-muted-foreground">
              {status === "bonus"
                ? entry?.detail
                  ? `Off-day · ${entry.detail}`
                  : "Off-day"
                : entry?.detail}
            </p>
          ) : item.minimalTask && !isDone ? (
            <p className="truncate text-micro text-muted-foreground/80">
              {item.minimalTask}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {creditedSeconds > 0 && (
          <span
            className="font-mono text-micro font-semibold text-running tabular-nums"
            title={
              entry?.practiceTimeAssumed
                ? "Assumed 10 min (no duration logged)"
                : undefined
            }
          >
            {formatDuration(creditedSeconds)}
            {entry?.practiceTimeAssumed && (
              <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
                est.
              </span>
            )}
          </span>
        )}
        <span
          className={cn(
            "text-micro font-medium",
            isDone
              ? "font-mono text-flow tabular-nums"
              : isSkipped
                ? "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                : "text-muted-foreground/75",
          )}
        >
          {isDone
            ? checkedTime ?? "Done"
            : isSkipped
              ? "Skipped"
              : isOpen
                ? "Still open"
                : "Not done"}
        </span>
      </div>
    </li>
  );
}
