"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";

import { togglePrayer } from "@/app/(app)/prayers/actions";
import { TaskCheckbox } from "@/components/task-checkbox";
import { formatMinuteOfDay } from "@/lib/block-math";
import type { PrayerCycleView, PrayerItem } from "@/lib/prayers";
import { cn } from "@/lib/utils";

/**
 * The prayer cycle on the day page: five rows, Fajr to Isha, each with its
 * window, each checkable only inside its own window. An unchecked prayer
 * stays visible after its window closes — "not prayed" is information, and
 * the row keeps saying it until the 4 AM reset.
 */
export function PrayerSection({ view }: { view: PrayerCycleView | null }) {
  if (!view) {
    return (
      <p className="text-muted-foreground mb-8 text-label">
        Prayer times are unavailable right now — they&apos;ll come back the
        next time the day loads.
      </p>
    );
  }

  const done = view.items.filter((item) => item.status === "done").length;

  return (
    <section className="mb-8">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="text-micro text-muted-foreground font-sans font-medium tracking-wider uppercase">
          Prayer
        </h2>
        <p className="text-muted-foreground text-micro tabular-nums">
          {done} of {view.items.length} · {view.city}
        </p>
      </div>
      <ul>
        {view.items.map((item) => (
          <PrayerRow key={item.prayer} item={item} dateISO={view.dateISO} />
        ))}
      </ul>
    </section>
  );
}

function PrayerRow({
  item,
  dateISO,
}: {
  item: PrayerItem;
  dateISO: string;
}) {
  const [, startTransition] = useTransition();

  const checkable = item.status === "active";

  const handleToggle = (next: boolean) => {
    if (next && !checkable) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("prayer", item.prayer);
      formData.set("date", dateISO);
      await togglePrayer(formData);
    });
  };

  const range = (
    <>
      <span className="tabular-nums">{formatMinuteOfDay(item.startMin)}</span>
      <span aria-hidden>–</span>
      <span className="tabular-nums">
        {formatMinuteOfDay(item.endMin % 1440)}
      </span>
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
      <span className="text-muted-foreground/70">not yet</span>
    ) : (
      <span className="text-muted-foreground/70">done</span>
    );

  return (
    <li className="group border-border/60 border-b last:border-b-0">
      <div className="flex items-center gap-3 py-2.5">
        {item.status === "done" || checkable ? (
          <TaskCheckbox
            done={item.status === "done"}
            label={`Prayed ${item.label}`}
            onToggle={handleToggle}
          />
        ) : (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-input opacity-50"
          >
            <Check className="size-3 opacity-0" strokeWidth={3} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-body",
              item.status === "done" && "text-muted-foreground",
            )}
          >
            {item.label}
          </p>
          <p
            className={cn(
              "text-muted-foreground text-micro tabular-nums",
              item.status === "upcoming" && "opacity-70",
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
