"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { toggleBlockBeat, toggleBlockTask } from "@/app/(app)/calendar/actions";
import { toggleStep } from "@/app/(app)/tasks/actions";
import { BeatSquare } from "@/components/beat-square";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/task-checkbox";
import { useNowMinute } from "@/hooks/use-now-minute";
import {
  formatMinuteOfDay,
  formatMinuteLength,
  formatSpanLength,
} from "@/lib/block-math";
import { beatStates } from "@/lib/block-beats";
import {
  buildQuestTimeline,
  pickHeroQuest,
  type AvailablePool,
  type Quest,
  type QuestBeat,
  type QuestObjective,
} from "@/lib/day-quests";
import { formatMinutes } from "@/lib/dates";
import type { TodayItem } from "@/lib/tasks";
import { buildTimerHref, RECOVERY_HREF } from "@/lib/timer-url";
import { DEFAULTS } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

import type { CalendarBlock } from "@/lib/time-blocks";

/**
 * The hero of the day, read as a quest.
 *
 * The day's plan — calendar blocks plus anchored habits — is one timeline, and
 * the hero names whichever quest the current minute makes true: the one in
 * progress, the one about to unlock, or, when the schedule is quiet, the
 * first thing that can be done right now. The countdown ticks with the same
 * 30-second rhythm as the calendar's now-line; the timeline itself is rebuilt
 * on every tick, so a block whose window opens or closes while the page sits
 * open swaps states without a reload.
 *
 * `serverNowMinute` keeps the server HTML and the first client render in
 * agreement — the hook returns null until its first tick, and the fallback
 * means both renders pick the same quest from the same minute.
 */
export function QuestHero({
  blocks,
  habits,
  available,
  serverNowMinute,
  timezone,
  dateISO,
}: {
  blocks: CalendarBlock[];
  habits: TodayItem[];
  available: AvailablePool;
  serverNowMinute: number;
  timezone: string;
  dateISO: string;
}) {
  const nowMinute = useNowMinute(timezone) ?? serverNowMinute;

  const quests = buildQuestTimeline({ blocks, habits, nowMinute });
  const hero = pickHeroQuest(quests, available, nowMinute);

  const calendarHref = `/calendar?view=day&date=${dateISO}`;

  switch (hero.kind) {
    case "ACTIVE_QUEST":
      return hero.quest.kind === "HABIT" ? (
        <HabitQuestCard quest={hero.quest} />
      ) : hero.quest.beat && hero.quest.beat.current !== null ? (
        <IntervalQuestCard
          quest={hero.quest}
          beat={hero.quest.beat}
          nowMinute={nowMinute}
          moreActive={hero.moreActive}
        />
      ) : (
        <BlockQuestCard
          quest={hero.quest}
          nowMinute={nowMinute}
          moreActive={hero.moreActive}
        />
      );
    case "REST_ACTIVE":
      return <RestQuestCard quest={hero.quest} nowMinute={nowMinute} />;
    case "FREE_ROAM":
      return (
        <FreeRoamCard
          untilMinute={hero.untilMinute}
          next={hero.next}
          nowMinute={nowMinute}
          calendarHref={calendarHref}
        />
      );
    case "NEXT_QUEST":
      return (
        <NextQuestCard
          quest={hero.quest}
          nowMinute={nowMinute}
          calendarHref={calendarHref}
        />
      );
    case "AVAILABLE":
      return <AvailableCard item={hero.item} />;
    case "ALL_DONE":
      return <AllDoneCard completedCount={hero.completedCount} />;
    case "NOTHING_PLANNED":
      return <NothingPlannedCard calendarHref={calendarHref} />;
  }
}

// ---------------------------------------------------------------- shared bits

const cardShell =
  "animate-rise mb-8 block rounded-xl border px-5 py-4 transition-colors md:py-5";

const eyebrowRow = "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";

const eyebrow = "text-micro font-medium tracking-wider uppercase";

const title = "font-display mt-1 truncate text-heading";

/** Timer link for a block objective, or null when it carries no setup. */
const objectiveHref = (objective: QuestObjective) =>
  buildTimerHref({
    id: objective.id,
    estimatedSeconds: objective.estimatedSeconds,
    defaultMode: objective.defaultMode,
    plannedIntervals: objective.plannedIntervals,
  });

/** Timer link for a habit quest, against its estimate the way every row does it. */
const habitHref = (item: TodayItem) =>
  buildTimerHref({
    id: item.id,
    estimatedSeconds:
      item.type === "HABIT"
        ? (item.estimatedSeconds ?? DEFAULTS.targetSeconds)
        : item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
  });

// ---------------------------------------------------------------- active: block

/**
 * The quest in progress: a claimed stretch whose window is open.
 *
 * The objectives are the block's own lines, ticked with the same block-scoped
 * tick the calendar uses — finishing the last one completes the quest, and the
 * hero hands the page to whatever comes next. The elapsed bar is the plan's
 * window draining, drawn in teal: no session is running, so the running blue
 * stays out of it.
 */
function BlockQuestCard({
  quest,
  nowMinute,
  moreActive,
}: {
  quest: Quest;
  nowMinute: number;
  moreActive: number;
}) {
  // Returns the action's promise: each TaskCheckbox holds its own transition
  // open on it, which is what keeps its pending ring up for the round trip.
  const toggleObjective = async (taskId: string, done: boolean) => {
    const formData = new FormData();
    formData.set("blockId", quest.id);
    formData.set("taskId", taskId);
    formData.set("done", String(done));
    await toggleBlockTask(formData);
  };

  const left = Math.max(0, quest.endMinute - nowMinute);
  const elapsed = Math.min(
    1,
    Math.max(0, (nowMinute - quest.startMinute) / (quest.endMinute - quest.startMinute)),
  );

  // The handle is the first line still standing — the thing the moment is for.
  const unticked = quest.objectives.find((objective) => objective.doneAt === null);
  const handle = unticked ?? quest.objectives[0];

  return (
    <div
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-primary/35 bg-accent/40 hover:border-primary/55 focus-within:ring-2 focus-within:ring-ring focus-within:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-primary")}>
          Active quest
          <span className="text-primary/80 ml-2 normal-case tabular-nums">
            {formatMinuteLength(left)} left · ends {formatMinuteOfDay(quest.endMinute)}
          </span>
        </p>
      </div>

      <p className={title}>{quest.title}</p>

      {quest.notes && (
        <p className="text-muted-foreground mt-0.5 truncate text-label">
          {quest.notes}
        </p>
      )}

      {quest.objectives.length > 0 && (
        <ul className="mt-3 space-y-2">
          {quest.objectives.map((objective) => (
            <li
              key={objective.id}
              className="pending-sweep flex items-center gap-3"
            >
              <TaskCheckbox
                done={objective.doneAt !== null}
                label={objective.title}
                onToggle={(next) => toggleObjective(objective.id, next)}
              />
              <span
                className={cn(
                  "text-body min-w-0 truncate",
                  objective.doneAt !== null && "text-muted-foreground line-through",
                )}
              >
                {objective.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {quest.objectives.length > 0 && (
        <div
          aria-hidden
          className="bg-muted mt-4 h-0.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-primary/70 h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.round(elapsed * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {handle ? (
          <Link
            href={objectiveHref(handle)}
            className="text-primary focus-visible:ring-ring rounded-md text-label font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Start a timer <span aria-hidden>→</span>
          </Link>
        ) : (
          <span />
        )}
        {moreActive > 0 && (
          <p className="text-muted-foreground text-micro">
            +{moreActive} more quest{moreActive === 1 ? "" : "s"} live now
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- active: interval

/**
 * An interval block whose window is open: one thing in this interval, then rest.
 *
 * The card has two moods and the current minute picks between them. Before the
 * interval has its thing, it offers the smallest candidates first — each
 * task's next unticked step, then the tasks themselves — plus a quiet way to
 * say "I did something else". Any one of them earns the interval; the server
 * stamps it on whichever came first. After, it says so and tells you when the
 * next one opens, and the drain bar follows the interval, not the whole block:
 * the rest is the point, and it should look like it ends.
 */
function IntervalQuestCard({
  quest,
  beat,
  nowMinute,
  moreActive,
}: {
  quest: Quest;
  beat: QuestBeat;
  nowMinute: number;
  moreActive: number;
}) {
  const current = beat.current ?? 0;
  const windowStart = beat.currentStart ?? quest.startMinute;
  const windowEnd = beat.currentEnd ?? quest.endMinute;
  const last = current === beat.count - 1;
  const untilNext = Math.max(0, windowEnd - nowMinute);
  const elapsed = Math.min(
    1,
    Math.max(0, (nowMinute - windowStart) / Math.max(1, windowEnd - windowStart)),
  );

  const states = beatStates({
    span: quest,
    minutes: beat.minutes,
    done: beat.done,
    day: "today",
    nowMinute,
  });

  const toggleBeat = async (index: number, done: boolean) => {
    const formData = new FormData();
    formData.set("blockId", quest.id);
    formData.set("index", String(index));
    formData.set("done", String(done));
    await toggleBlockBeat(formData);
  };

  const tickStep = async (stepId: string, done: boolean) => {
    const formData = new FormData();
    formData.set("stepId", stepId);
    formData.set("done", String(done));
    await toggleStep(formData);
  };

  const toggleObjective = async (taskId: string, done: boolean) => {
    const formData = new FormData();
    formData.set("blockId", quest.id);
    formData.set("taskId", taskId);
    formData.set("done", String(done));
    await toggleBlockTask(formData);
  };

  const [marking, startMarking] = useTransition();

  const steps = quest.objectives.filter((objective) => objective.nextStep);
  const open = quest.objectives.filter((objective) => objective.doneAt === null);

  return (
    <div
      className={cn(
        cardShell,
        "border-primary/35 bg-accent/40 focus-within:ring-ring focus-within:ring-2 focus-within:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-primary")}>
          Interval{" "}
          <span className="tabular-nums">
            {current + 1} of {beat.count}
          </span>
          <span className="text-primary/80 ml-2 normal-case tabular-nums">
            {last
              ? `${formatMinuteLength(untilNext)} left · ends ${formatMinuteOfDay(windowEnd)}`
              : `next in ${formatMinuteLength(untilNext)}`}
          </span>
        </p>
      </div>

      <p className={title}>{quest.title}</p>

      <div className="-ml-3 mt-1 flex flex-wrap" role="group" aria-label="Intervals">
        {states.map((state, index) => (
          <BeatSquare
            key={index}
            state={state}
            label={`Interval ${index + 1} of ${beat.count}`}
            onToggle={() => toggleBeat(index, state !== "done")}
            className="text-foreground size-9"
          />
        ))}
      </div>

      {beat.currentDone ? (
        <div className="mt-2">
          <p className="text-body">
            That&apos;s this interval.{" "}
            {last ? "That was the last one." : `Rest until ${formatMinuteOfDay(windowEnd)}.`}
          </p>
          {beat.currentLabel && (
            <p className="text-muted-foreground mt-0.5 truncate text-label">
              Done: {beat.currentLabel}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-body">
            Do one thing. Small counts, rushed counts.
          </p>

          {(steps.length > 0 || open.length > 0) && (
            <ul className="mt-3 space-y-2">
              {steps.map((objective) => (
                <li
                  key={`step-${objective.nextStep!.id}`}
                  className="pending-sweep flex items-center gap-3"
                >
                  <TaskCheckbox
                    done={false}
                    label={objective.nextStep!.title}
                    onToggle={(next) => tickStep(objective.nextStep!.id, next)}
                  />
                  <span className="min-w-0">
                    <span className="text-body block truncate">
                      {objective.nextStep!.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-micro">
                      Next step of {objective.title}
                    </span>
                  </span>
                </li>
              ))}
              {open.map((objective) => (
                <li
                  key={objective.id}
                  className="pending-sweep flex items-center gap-3"
                >
                  <TaskCheckbox
                    done={false}
                    label={objective.title}
                    onToggle={(next) => toggleObjective(objective.id, next)}
                  />
                  <span className="text-body min-w-0 truncate">
                    {objective.title}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground mt-2 -ml-3 min-h-11"
            disabled={marking}
            onClick={() => startMarking(() => toggleBeat(current, true))}
          >
            {marking ? "Marking…" : "Did something else"}
          </Button>
        </div>
      )}

      <div
        aria-hidden
        className="bg-muted mt-4 h-0.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
            beat.currentDone ? "bg-rest/70" : "bg-primary/70",
          )}
          style={{ width: `${Math.round(elapsed * 100)}%` }}
        />
      </div>

      {moreActive > 0 && (
        <p className="text-muted-foreground mt-3 text-micro">
          +{moreActive} more quest{moreActive === 1 ? "" : "s"} live now
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- active: habit

/**
 * The habit whose moment it is — no block speaks for it, so the hero does.
 * The card is one link to the timer, as "the row itself is the timer" holds
 * everywhere else.
 */
function HabitQuestCard({ quest }: { quest: Quest }) {
  const habit = quest.habit;
  if (!habit) return null;

  const steps = habit.steps ?? [];
  const upNext = steps.find((step) => step.completedAt === null);
  const meta = upNext
    ? `Next: ${upNext.title}`
    : habit.cue?.anchorTitle
      ? `After ${habit.cue.anchorTitle}`
      : null;

  return (
    <Link
      href={habitHref(habit)}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-primary/35 bg-accent/40 hover:border-primary/55 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-primary")}>
          Active quest
          <span className="text-primary/80 ml-2 normal-case tabular-nums">
            now · at {formatMinuteOfDay(quest.startMinute)}
          </span>
        </p>
        <span className="text-primary shrink-0 text-label font-medium">
          Set a timer <span aria-hidden>→</span>
        </span>
      </div>

      <p className={title}>{quest.title}</p>

      {meta && (
        <p className="text-muted-foreground mt-0.5 truncate text-label">{meta}</p>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------- rest

/**
 * A recovery block in its window. Rest gets its own colour and no draining
 * bar — a countdown would turn rest into work, which is the exact failure
 * the recovery mode exists to prevent. The card says until when, and that's all.
 */
function RestQuestCard({ quest, nowMinute }: { quest: Quest; nowMinute: number }) {
  const left = Math.max(0, quest.endMinute - nowMinute);

  return (
    <Link
      href={RECOVERY_HREF}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-rest/40 bg-rest/10 hover:border-rest/60 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-rest")}>
          Rest active
          <span className="text-rest/80 ml-2 normal-case tabular-nums">
            until {formatMinuteOfDay(quest.endMinute)} · {formatMinuteLength(left)} left
          </span>
        </p>
        <span className="text-rest shrink-0 text-label font-medium">
          Open recovery timer <span aria-hidden>→</span>
        </span>
      </div>

      <p className={title}>{quest.title}</p>
    </Link>
  );
}

// ---------------------------------------------------------------- free roam

/**
 * Only open time is claimed right now — the plan's buffer, in game terms free
 * roam. The card names the next quest and the countdown to it, so the open
 * stretch has a horizon instead of being an unstructured void.
 */
function FreeRoamCard({
  untilMinute,
  next,
  nowMinute,
  calendarHref,
}: {
  untilMinute: number | null;
  next: Quest | null;
  nowMinute: number;
  calendarHref: string;
}) {
  return (
    <Link
      href={calendarHref}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-dashed border-border hover:border-primary/50 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-muted-foreground")}>Free roam</p>
        <span className="text-muted-foreground shrink-0 text-label font-medium">
          Open the calendar <span aria-hidden>→</span>
        </span>
      </div>

      <p className="text-muted-foreground mt-1 text-body">
        Open time
        {untilMinute !== null && nowMinute < untilMinute && (
          <>
            {" "}until{" "}
            <span className="text-foreground tabular-nums">
              {formatMinuteOfDay(untilMinute)}
            </span>
          </>
        )}
        {untilMinute === null && " — the rest of today is yours"}
      </p>

      {next && (
        <p className="mt-1 truncate text-label">
          <span className="text-foreground">Next quest: {next.title}</span>
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · unlocks in {formatMinuteLength(Math.max(0, next.startMinute - nowMinute))} ·
            at {formatMinuteOfDay(next.startMinute)}
          </span>
        </p>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------- next quest

/**
 * Nothing is in its window: the next quest, with the countdown to it. The
 * countdown is the point of this state, so it gets its own mono line rather
 * than hiding in the eyebrow.
 */
function NextQuestCard({
  quest,
  nowMinute,
  calendarHref,
}: {
  quest: Quest;
  nowMinute: number;
  calendarHref: string;
}) {
  const unlocked = nowMinute >= quest.startMinute;
  const when = unlocked
    ? "now"
    : `unlocks in ${formatMinuteLength(quest.startMinute - nowMinute)} · at ${formatMinuteOfDay(quest.startMinute)}`;

  const handle =
    quest.kind === "HABIT"
      ? quest.habit
        ? habitHref(quest.habit)
        : null
      : quest.objectives.length > 0
        ? objectiveHref(
            quest.objectives.find((objective) => objective.doneAt === null) ??
              quest.objectives[0],
          )
        : null;

  const href = handle ?? calendarHref;
  const cta = handle ? "Set a timer" : "Open the calendar";

  const metaParts: string[] = [];
  if (quest.kind !== "HABIT") {
    const count = quest.objectives.length;
    if (count > 0) {
      metaParts.push(
        count === 1 ? "1 objective" : `${count} objectives`,
        formatSpanLength({ startMinute: quest.startMinute, endMinute: quest.endMinute }),
      );
    }
  } else if (quest.habit?.cue?.anchorTitle) {
    metaParts.push(`After ${quest.habit.cue.anchorTitle}`);
  }

  return (
    <Link
      href={href}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-primary/35 bg-accent/40 hover:border-primary/55 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-primary")}>Next quest</p>
        <span className="text-primary shrink-0 text-label font-medium">
          {cta} <span aria-hidden>→</span>
        </span>
      </div>

      <p className={title}>{quest.title}</p>

      <p className="text-primary/90 mt-1 text-label font-medium tabular-nums">
        {when}
      </p>

      {metaParts.length > 0 && (
        <p className="text-muted-foreground mt-0.5 truncate text-label">
          {metaParts.join(" · ")}
        </p>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------- available

/**
 * The schedule is quiet and the backlog speaks first: an overdue, due-today,
 * anytime, or unanchored pick. Same card the "start here" hero wore, with the
 * quest's own name for it.
 */
function AvailableCard({ item }: { item: TodayItem }) {
  const lateByDays =
    item.timeAnchorMinutes === null &&
    item.daysUntilDue !== null &&
    item.daysUntilDue < 0
      ? -item.daysUntilDue
      : null;

  const meta = lateByDays !== null
    ? `${lateByDays} day${lateByDays === 1 ? "" : "s"} late`
    : item.estimatedSeconds
      ? formatMinutes(item.estimatedSeconds)
      : item.cue?.anchorTitle
        ? `After ${item.cue.anchorTitle}`
        : null;

  const steps = item.steps ?? [];
  const upNext = steps.find((step) => step.completedAt === null);

  return (
    <Link
      href={habitHref(item)}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-primary/35 bg-accent/40 hover:border-primary/55 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <div className={eyebrowRow}>
        <p className={cn(eyebrow, "text-primary")}>Available quest</p>
        <span className="text-primary shrink-0 text-label font-medium">
          Set a timer <span aria-hidden>→</span>
        </span>
      </div>

      <p className={title}>{item.title}</p>

      <p className="text-muted-foreground mt-0.5 truncate text-label">
        {upNext && <span>Next: {upNext.title}. </span>}
        {meta && (
          <span className={cn(lateByDays !== null && "text-destructive")}>
            {meta}
          </span>
        )}
      </p>
    </Link>
  );
}

// ---------------------------------------------------------------- quiet ends

function AllDoneCard({ completedCount }: { completedCount: number }) {
  return (
    <div className={cn(cardShell, "border-border bg-secondary/40")}>
      <p className="flex items-center gap-2 text-label font-medium">
        <CheckCircle2 className="text-primary size-4" aria-hidden />
        All quests complete
      </p>
      <p className="text-muted-foreground mt-1 text-label">
        {completedCount} done today. Anything else is a bonus.
      </p>
    </div>
  );
}

function NothingPlannedCard({ calendarHref }: { calendarHref: string }) {
  return (
    <Link
      href={calendarHref}
      className={cn(
        cardShell,
        "focus-visible:ring-ring border-dashed border-border hover:border-primary/50 focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <p className={cn(eyebrow, "text-muted-foreground")}>No quests yet</p>
      <p className="text-foreground mt-1 text-body">
        Claim your first stretch of the day on the calendar{" "}
        <span aria-hidden>→</span>
      </p>
    </Link>
  );
}
