"use client";

import { useContext } from "react";
import { Check } from "lucide-react";

import { formatMinuteOfDay } from "@/lib/block-math";
import { CALENDAR_COLORS } from "@/lib/calendar-colors";
import type { PrayerBand } from "@/lib/prayers";
import { cn } from "@/lib/utils";

import { NowContext } from "./calendar-grid";

/** Prayer windows are annotations, never click targets. Full timings and
 * check-off actions live in the day header so the entire grid stays usable. */
export function PrayerBands({
  bands,
  isToday,
  minutePx,
}: {
  bands: PrayerBand[];
  isToday: boolean;
  minutePx: number;
}) {
  const nowMinute = useContext(NowContext);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bands.map((band) => {
        const active =
          isToday &&
          nowMinute !== null &&
          nowMinute >= band.startMin &&
          nowMinute < band.endMin;

        return (
          <div
            key={`${band.ownerISO}-${band.prayer}`}
            className={cn(
              "pointer-events-none absolute inset-x-0 overflow-hidden border-l-2",
              band.continuation && "border-dashed",
            )}
            style={{
              top: band.startMin * minutePx,
              height: (band.endMin - band.startMin) * minutePx,
              borderColor: `${CALENDAR_COLORS.lavender}${active ? "b3" : "59"}`,
            }}
          >
            <div className="text-muted-foreground bg-card/90 mt-1 ml-1 flex w-fit max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-sm px-1 text-micro leading-4">
              <span className={cn("truncate", band.continuation && "italic")}>
                {band.label}{" "}
                <span className="tabular-nums">
                  {band.continuation ? "continued" : formatMinuteOfDay(band.startMin)}
                </span>
              </span>
              {band.checked && <Check className="size-3 shrink-0" aria-hidden />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
