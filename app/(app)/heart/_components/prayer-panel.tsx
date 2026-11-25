"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { togglePrayer } from "@/app/(app)/prayers/actions";
import { InfoTip } from "@/components/info-tip";
import { SceneCard } from "@/components/scenes/scene-card";
import { TaskCheckbox } from "@/components/task-checkbox";
import { formatMinuteOfDay } from "@/lib/block-math";
import type { PrayerHabitView } from "@/lib/heart-data";
import type { PrayerItem } from "@/lib/prayers";
import { cn } from "@/lib/utils";

/**
 * The prayer tab: the lamplit town, kept by each day all five are prayed,
 * then today's five, Fajr to Isha, each with its window. A prayer is
 * checkable inside its own window, or afterwards once it closes: a "late"
 * row takes a check, so a prayer prayed late is still recorded. Upcoming
 * rows stay locked. The day turns over when Isha's window closes, 30
 * minutes before the next Fajr.
 */
export function PrayerPanel({ view }: { view: PrayerHabitView }) {
  const { cycle, tending } = view;

  return (
    <div className="space-y-6">
      <SceneCard tab="prayer" tending={tending} />

      {!cycle ? (
        <p className="text-muted-foreground border-border/80 rounded-2xl border border-dashed px-4 py-8 text-center text-label">
          Prayer times are unavailable right now. They&apos;ll come back the next time the page loads.
        </p>
      ) : (
        <section aria-labelledby="prayer-today" className="border-border bg-card rounded-2xl border px-5 py-4 sm:px-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="prayer-today" className="font-display flex items-center gap-1 text-xl">
              Today&apos;s prayers <InfoTip term="prayer" />
            </h2>
            <p className="text-muted-foreground text-micro tabular-nums">
              {cycle.items.filter((item) => item.status === "done").length} of {cycle.items.length} ·{" "}
              <Link href="/settings#heart" className="hover:text-foreground underline-offset-4 hover:underline">
                {cycle.city}
              </Link>
            </p>
          </div>
          <ul>
            {cycle.items.map((item) => (
              <PrayerRow key={item.prayer} item={item} dateISO={cycle.dateISO} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PrayerRow({ item, dateISO }: { item: PrayerItem; dateISO: string }) {
  const checkable = item.status === "active" || item.status === "missed";

  // Returns the action's promise: TaskCheckbox holds its own transition open
  // on it, which is what keeps the pending ring showing for the round trip.
  const handleToggle = async (next: boolean) => {
    if (next && !checkable) return;
    const formData = new FormData();
    formData.set("prayer", item.prayer);
    formData.set("date", dateISO);
    await togglePrayer(formData);
  };

  const range = (
    <>
      <span className="tabular-nums">{formatMinuteOfDay(item.startMin)}</span>
      <span aria-hidden>–</span>
      <span className="tabular-nums">{formatMinuteOfDay(item.endMin % 1440)}</span>
      {item.endMin > 1440 && (
        <span className="text-muted-foreground/70" aria-hidden>
          {" "}+1
        </span>
      )}
    </>
  );

  const tag =
    item.status === "active" ? (
      <span className="text-primary font-medium">now</span>
    ) : item.status === "upcoming" ? (
      <span className="text-muted-foreground/70">later</span>
    ) : item.status === "missed" ? (
      <span className="text-muted-foreground/70">late</span>
    ) : (
      <span className="text-muted-foreground/70">done</span>
    );

  return (
    <li className="group pending-sweep border-border/60 border-b last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        {item.status === "done" || checkable ? (
          <TaskCheckbox done={item.status === "done"} label={`Prayed ${item.label}`} onToggle={handleToggle} />
        ) : (
          <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-input opacity-50">
            <Check className="size-3 opacity-0" strokeWidth={3} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className={cn("text-body", item.status === "done" && "text-muted-foreground")}>{item.label}</p>
          <p
            className={cn(
              "text-muted-foreground text-micro tabular-nums",
              (item.status === "upcoming" || item.status === "missed") && "opacity-70",
            )}
          >
            {range}
          </p>
        </div>

        {tag}
      </div>
    </li>
  );
}
