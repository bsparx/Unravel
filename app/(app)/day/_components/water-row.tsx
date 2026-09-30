"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Droplets, Plus } from "lucide-react";

import { logGlass } from "@/app/(app)/water/actions";
import { PendingRing } from "@/components/ui/spinner";
import {
  expectedByNow,
  waterStatusShort,
} from "@/lib/water";
import type { WaterToday } from "@/lib/water-data";

/**
 * The compact water row on /day. The row body links to /water; the + button
 * logs a glass without leaving the day — same optimistic one-tap as the
 * vessel, in a space the size of a list row.
 */
export function WaterRow({
  today,
  timezone,
}: {
  today: WaterToday;
  timezone: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [shown, applyDelta] = useOptimistic(today.count, (current, delta: number) =>
    current + delta,
  );

  // Null until the first client tick, exactly like the calendar's now-line:
  // the server has no "now" the client can agree with to the minute, and a
  // pace verdict rendered at a server-computed minute would hydrate wrong.
  const [nowMinute, setNowMinute] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());

      const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

      setNowMinute(value("hour") * 60 + value("minute"));
    };

    read();
    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [timezone]);

  const { goal } = today.settings;
  const expected =
    nowMinute === null
      ? null
      : expectedByNow(
          goal,
          today.settings.startMin,
          today.settings.endMin,
          nowMinute,
        );
  const status =
    expected === null
      ? ""
      : waterStatusShort({ glasses: shown, goal, expected });

  const log = () => {
    startTransition(async () => {
      applyDelta(1);
      const formData = new FormData();
      formData.set("date", today.dateISO);
      await logGlass(formData);
    });
  };

  return (
    <li className="pending-sweep border-border/60 border-b">
      <div className="flex items-center gap-3 py-2.5">
        <Link
          href="/water"
          className="focus-visible:ring-ring -my-1 min-w-0 flex-1 rounded-md px-1 py-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex items-baseline gap-2">
            <span className="truncate text-body">Water</span>
          </span>
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-label">
            <Droplets className="size-3 shrink-0" aria-hidden />
            {status || "Checking the pace line…"}
          </span>
        </Link>

        <span className="text-label shrink-0 tabular-nums">
          {shown}
          <span className="text-muted-foreground">/{goal}</span>
        </span>

        {/* Not disabled while pending: the count is optimistic, so a second
            tap is a second glass, and the ring just says the last one is
            still on its way. */}
        <button
          type="button"
          onClick={log}
          aria-busy={isPending}
          aria-label="Log a glass of water"
          className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 focus-visible:ring-ring relative rounded-full border p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" aria-hidden />
          <PendingRing active={isPending} shape="circle" />
        </button>
      </div>
    </li>
  );
}
