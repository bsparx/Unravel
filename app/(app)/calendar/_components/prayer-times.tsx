"use client";

import { useContext, useId, useTransition } from "react";
import { Check, Moon } from "lucide-react";
import { toast } from "sonner";

import { togglePrayer } from "@/app/(app)/prayers/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMinuteOfDay } from "@/lib/block-math";
import { CALENDAR_COLORS } from "@/lib/calendar-colors";
import type { PrayerBand } from "@/lib/prayers";
import { cn } from "@/lib/utils";

import { NowContext } from "./calendar-grid";

export function PrayerTimes({
  bands,
  isToday,
  dayLabel,
}: {
  bands: PrayerBand[];
  isToday: boolean;
  dayLabel: string;
}) {
  const nowMinute = useContext(NowContext);
  const titleId = useId();
  const [pending, startTransition] = useTransition();

  if (bands.length === 0) return null;

  const markPrayed = (band: PrayerBand) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("prayer", band.prayer);
        formData.set("date", band.ownerISO);
        await togglePrayer(formData);
      } catch {
        toast.error("Couldn't mark this prayer. Please try again.");
      }
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`Prayer times for ${dayLabel}`}
          className="text-muted-foreground mt-1 w-full min-w-0 gap-1 px-1 font-normal"
        >
          <Moon className="size-3" aria-hidden />
          <span className="truncate">Prayer times</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" aria-labelledby={titleId} className="w-80 max-w-[calc(100vw-2rem)] p-3">
        <div>
          <h2 id={titleId} className="font-medium">Prayer times</h2>
          <p className="text-muted-foreground text-xs">{dayLabel}</p>
        </div>
        <ul className="space-y-1">
          {bands.map((band) => {
            const active =
              isToday &&
              nowMinute !== null &&
              nowMinute >= band.startMin &&
              nowMinute < band.endMin;
            const canCheck = active && !band.checked;

            return (
              <li
                key={`${band.ownerISO}-${band.prayer}`}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-1",
                  active && "bg-muted",
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-label font-medium">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: CALENDAR_COLORS.lavender }} aria-hidden />
                    {band.label}
                    {band.continuation && <span className="text-muted-foreground text-xs font-normal">continued</span>}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMinuteOfDay(band.startMin)} – {formatMinuteOfDay(band.endMin)}
                    {active && !band.checked && <span className="ml-1.5">· Now</span>}
                  </p>
                </div>
                {canCheck ? (
                  <Button
                    variant="outline"
                    size="xs"
                    loading={pending}
                    aria-label={`Mark ${band.label} prayed`}
                    onClick={() => markPrayed(band)}
                  >
                    <Check className="size-3" aria-hidden />
                    Prayed
                  </Button>
                ) : band.checked ? (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Check className="size-3" aria-hidden />
                    Prayed
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
