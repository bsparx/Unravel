"use client";

import Link from "next/link";

import {
  formatMinuteOfDay,
  formatMinuteLength,
} from "@/lib/block-math";
import { formatMinutes } from "@/lib/dates";
import { nextStep } from "@/lib/steps";
import type { TodayItem } from "@/lib/tasks";
import { buildTimerHref } from "@/lib/timer-url";

import { useNowMinute } from "@/hooks/use-now-minute";

/**
 * The one obvious next action, as the hero of the day.
 *
 * Everything below it is inventory; this is the decision already made. The
 * time line does the arithmetic the moment is asking for — "in 28 minutes ·
 * at 15:00" — because a felt sense of duration is exactly what this audience
 * doesn't have. The countdown ticks with the same 30-second rhythm as the
 * calendar's now-line, and renders its static form until the first client
 * tick so the server HTML and the first client render agree.
 */
export function StartHere({
  item,
  timezone,
}: {
  item: TodayItem;
  timezone: string;
}) {
  const nowMinute = useNowMinute(timezone);

  const href = buildTimerHref({
    id: item.id,
    estimatedSeconds: item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
  });

  // One line, computed from the same fallback chain the page used to pick
  // this item: a time anchor reads as a countdown, an overdue todo reads as
  // how late, anything else reads as the estimate.
  const lateByDays =
    item.timeAnchorMinutes === null &&
    item.daysUntilDue !== null &&
    item.daysUntilDue < 0
      ? -item.daysUntilDue
      : null;

  let when: React.ReactNode = null;
  if (item.timeAnchorMinutes !== null) {
    const anchor = item.timeAnchorMinutes;
    const diff = nowMinute === null ? null : anchor - nowMinute;
    when =
      diff === null ? (
        <>at {formatMinuteOfDay(anchor)}</>
      ) : diff > 0 ? (
        <>
          in {formatMinuteLength(diff)} · at {formatMinuteOfDay(anchor)}
        </>
      ) : (
        <>now · {formatMinuteOfDay(anchor)}</>
      );
  } else if (lateByDays !== null) {
    when = (
      <span className="text-destructive">
        {lateByDays} day{lateByDays === 1 ? "" : "s"} late
      </span>
    );
  } else if (item.estimatedSeconds) {
    when = <>{formatMinutes(item.estimatedSeconds)}</>;
  }

  const steps = item.steps ?? [];
  const upNext = nextStep(steps);
  const meta = upNext
    ? `Next: ${upNext.title}`
    : item.cue?.anchorTitle
      ? `After ${item.cue.anchorTitle}`
      : null;

  return (
    <Link
      href={href}
      className="border-primary/35 hover:border-primary/55 focus-visible:ring-ring animate-rise group mb-8 block rounded-xl border bg-accent/40 px-5 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-none md:py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-micro text-primary font-medium tracking-wider uppercase">
          Start here
          {when && <span className="ml-2 normal-case">· {when}</span>}
        </p>
        <span className="text-primary shrink-0 text-label font-medium">
          Set a timer <span aria-hidden>→</span>
        </span>
      </div>

      <p className="font-display mt-1 truncate text-heading">{item.title}</p>

      {meta && (
        <p className="text-muted-foreground mt-0.5 truncate text-label">
          {meta}
        </p>
      )}
    </Link>
  );
}
