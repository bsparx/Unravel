"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { ChevronDown, GlassWater, Minus } from "lucide-react";

import { logGlass, removeGlass } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMinuteOfDay, type WaterSettings } from "@/lib/water";
import type { WaterGlassRow } from "@/lib/water-data";
import { cn } from "@/lib/utils";

/**
 * The day's glasses, correctable in place — the "I forgot to log lunch" path.
 *
 * The vessel above is for the present; this is for the record. Every row can
 * be removed (a glass logged twice), and a glass can be backdated to any
 * earlier hour of the day, so the pace line and "last glass was 3h ago" stay
 * things the app can say truthfully.
 *
 * Corrections are optimistic like the vessel: a removal that waits for the
 * round-trip feels like the row ignored you.
 */
export function DayGlasses({
  dateISO,
  glasses,
  settings,
  initialNowMinute,
}: {
  dateISO: string;
  glasses: WaterGlassRow[];
  settings: WaterSettings;
  initialNowMinute: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const [shown, applyDelta] = useOptimistic(
    glasses,
    (
      current,
      patch: { remove?: string; add?: number },
    ) =>
      patch.remove !== undefined
        ? current.filter((row) => row.id !== patch.remove)
        : patch.add !== undefined
          ? [...current, { id: `new-${patch.add}`, timeMinute: patch.add }].sort(
              (a, b) => a.timeMinute - b.timeMinute,
            )
          : current,
  );

  // Every whole hour of the day that is strictly in the past — the backdate
  // menu. "Now" is the vessel's job; the menu only holds earlier times.
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let m = settings.startMin; m + 60 <= initialNowMinute; m += 60) {
      out.push(m);
    }
    return out;
  }, [settings.startMin, initialNowMinute]);

  const remove = (row: WaterGlassRow) => {
    applyDelta({ remove: row.id });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("glassId", row.id);
      await removeGlass(formData);
    });
  };

  const backdate = (formData: FormData) => {
    const minute = Number(formData.get("timeMinute"));
    if (!Number.isFinite(minute)) return;
    applyDelta({ add: minute });
    startTransition(async () => {
      await logGlass(formData);
    });
  };

  return (
    <section className="border-border bg-card rounded-lg border px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Hide" : "Show"} today's glasses`}
        className="focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-label font-medium">Edit today</span>
          <span className="text-muted-foreground tabular-nums">
            {shown.length} logged
          </span>
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-label">
              Nothing logged yet. Tap the glass above, or backdate one below.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-0.5"
                >
                  <span className="text-muted-foreground flex items-center gap-2 font-mono text-label tabular-nums">
                    <GlassWater className="size-3.5" aria-hidden />
                    {formatMinuteOfDay(row.timeMinute)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    aria-label={`Remove the ${formatMinuteOfDay(row.timeMinute)} glass`}
                    className="border-border text-muted-foreground hover:text-foreground hover:border-primary/50 focus-visible:ring-ring rounded-full border p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hours.length > 0 && (
            <form
              action={backdate}
              className="border-border flex items-center gap-2 border-t pt-3"
            >
              <input type="hidden" name="date" value={dateISO} />
              <Select
                name="timeMinute"
                defaultValue={String(hours[hours.length - 1])}
              >
                <SelectTrigger
                  className="w-28"
                  aria-label="When was the glass?"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((minute) => (
                    <SelectItem key={minute} value={String(minute)}>
                      {formatMinuteOfDay(minute)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm">
                Log an earlier glass
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
