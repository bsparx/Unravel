"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { useNowMinute } from "@/hooks/use-now-minute";
import { formatMinuteOfDay, formatMinuteLength } from "@/lib/block-math";
import { buildQuestTimeline, questProgress, type Quest } from "@/lib/day-quests";
import type { TodayItem } from "@/lib/tasks";
import type { CalendarBlock } from "@/lib/time-blocks";
import { cn } from "@/lib/utils";

import { questHref } from "./quest-links";

/**
 * The day's quests, in the order they were claimed.
 *
 * Blocks and anchored habits in one timeline — the calendar's plan read as a
 * quest log. Each row carries its state the way a game's quest list does:
 * complete, in progress now, unlocking in N minutes, or past its window
 * unticked. The whole row is the timer for the quest's next line, and the
 * header keeps the count that only goes up: N/M complete.
 *
 * The timeline rebuilds on every 30-second tick, so states stay true while
 * the page sits open — a quest in progress becomes the past on its own.
 */
export function QuestLog({
  blocks,
  habits,
  serverNowMinute,
  timezone,
  dateISO,
}: {
  blocks: CalendarBlock[];
  habits: TodayItem[];
  serverNowMinute: number;
  timezone: string;
  dateISO: string;
}) {
  const nowMinute = useNowMinute(timezone) ?? serverNowMinute;

  const quests = buildQuestTimeline({ blocks, habits, nowMinute });
  const { complete, total } = questProgress(quests);

  // An empty day has no log — the hero's "no quests yet" card covers it.
  if (total === 0) return null;

  const calendarHref = `/calendar?view=day&date=${dateISO}`;

  return (
    <section className="mb-8">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
          Today&apos;s quests
          <span className="ml-2 tabular-nums opacity-60">
            {complete}/{total}
          </span>
        </h2>
        <Link
          href={calendarHref}
          className="text-micro text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Edit on the calendar
        </Link>
      </div>

      <ul className="border-border bg-card divide-border/60 divide-y rounded-xl border px-4 py-1.5">
        {quests.map((quest) => (
          <QuestRow key={quest.id} quest={quest} nowMinute={nowMinute} calendarHref={calendarHref} />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- rows

const KIND_DOT: Record<Quest["kind"], string> = {
  WORK: "border-primary bg-primary",
  RECOVERY: "border-rest bg-rest",
  BUFFER: "border-muted-foreground/40 bg-muted-foreground/40",
  HABIT: "border-primary bg-primary",
};

const KIND_HOLLOW: Record<Quest["kind"], string> = {
  WORK: "border-primary",
  RECOVERY: "border-rest",
  BUFFER: "border-muted-foreground/40",
  HABIT: "border-primary",
};

function QuestRow({
  quest,
  nowMinute,
  calendarHref,
}: {
  quest: Quest;
  nowMinute: number;
  calendarHref: string;
}) {
  // One line of what the quest holds: the cue marker, the objectives'
  // progress, and the window's length — whichever parts exist.
  const parts = [
    quest.isCue && "cue",
    quest.objectives.length > 0 &&
      `${quest.objectives.filter((o) => o.doneAt !== null).length}/${quest.objectives.length}`,
    quest.kind !== "HABIT" &&
      formatMinuteLength(quest.endMinute - quest.startMinute),
  ].filter((part): part is string => Boolean(part));
  const meta = parts.join(" · ");

  return (
    <li>
      <Link
        href={questHref(quest, calendarHref)}
        className={cn(
          "focus-visible:ring-ring -mx-1 flex items-center gap-3 rounded-lg px-1 py-2.5 transition-opacity focus-visible:ring-2 focus-visible:outline-none",
          quest.state === "PAST" && "opacity-55",
          quest.state === "COMPLETE" && "opacity-70",
        )}
      >
        <StateGlyph quest={quest} />

        <span
          className={cn(
            "text-muted-foreground w-[6.75rem] shrink-0 text-label tabular-nums",
            quest.kind === "BUFFER" && "text-muted-foreground/70",
          )}
        >
          {formatMinuteOfDay(quest.startMinute)}
          {quest.kind !== "HABIT" && `–${formatMinuteOfDay(quest.endMinute)}`}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "text-body block truncate",
              quest.state === "COMPLETE" &&
                "text-muted-foreground line-through",
            )}
          >
            {quest.title}
          </span>
          {meta && (
            <span className="text-muted-foreground/80 block truncate text-micro">
              {meta}
            </span>
          )}
        </span>

        <StateChip quest={quest} nowMinute={nowMinute} />
      </Link>
    </li>
  );
}

/**
 * The quest's state, at the size of a bullet. Complete carries a check;
 * anything in its window is a filled dot in its kind's colour; everything
 * else is hollow until its time comes.
 */
function StateGlyph({ quest }: { quest: Quest }) {
  if (quest.state === "COMPLETE") {
    return (
      <span
        aria-hidden
        className="text-primary grid size-4 shrink-0 place-items-center"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }

  if (quest.state === "ACTIVE") {
    return (
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", KIND_DOT[quest.kind])}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full border-2 bg-transparent", KIND_HOLLOW[quest.kind])}
    />
  );
}

function StateChip({
  quest,
  nowMinute,
}: {
  quest: Quest;
  nowMinute: number;
}) {
  const chip = "shrink-0 text-micro font-medium tabular-nums";

  switch (quest.state) {
    case "COMPLETE":
      return <span className={cn(chip, "text-muted-foreground")}>Complete</span>;
    case "PAST":
      return (
        <span className={cn(chip, "text-muted-foreground/70")}>Past</span>
      );
    case "ACTIVE":
      if (quest.kind === "RECOVERY") {
        return (
          <span className={cn(chip, "bg-rest/15 text-rest rounded-full px-2 py-0.5")}>
            Recovering
          </span>
        );
      }
      if (quest.kind === "BUFFER") {
        return <span className={cn(chip, "text-muted-foreground")}>Open</span>;
      }
      return (
        <span className={cn(chip, "bg-accent text-accent-foreground rounded-full px-2 py-0.5")}>
          Now
        </span>
      );
    case "UPCOMING": {
      const inMinutes = quest.startMinute - nowMinute;
      if (inMinutes <= 0) {
        return <span className={cn(chip, "text-primary")}>Now</span>;
      }
      return (
        <span className={cn(chip, "text-muted-foreground")}>
          in {formatMinuteLength(inMinutes)}
        </span>
      );
    }
  }
}
