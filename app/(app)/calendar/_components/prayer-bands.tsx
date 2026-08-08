"use client";

import { useContext, useTransition } from "react";
import { Check } from "lucide-react";

import { togglePrayer } from "@/app/(app)/prayers/actions";
import { formatMinuteOfDay } from "@/lib/block-math";
import { CALENDAR_COLORS } from "@/lib/calendar-colors";
import type { PrayerBand } from "@/lib/prayers";
import { cn } from "@/lib/utils";

import { NowContext } from "./calendar-grid";

/**
 * The prayer windows of one calendar column, as quiet tinted bands behind the
 * plan. Lavender, deliberately: teal is work, the task hues are identity, and
 * amber is reserved for the running clock — nothing else on the grid wears
 * this colour, so the prayer hours read as a separate layer of the day.
 *
 * Bands never intercept clicks (the slots underneath must stay draggable);
 * the only interactive element is a band's check button, offered when the
 * window is actually open — the same gate the day page uses.
 */

const FILL = CALENDAR_COLORS.lavender;
/** A band checked off is a completed act: a stronger fill, but still a band. */
const FILL_CHECKED = `${FILL}40`;
const FILL_OPEN = `${FILL}1a`;
const BORDER = `${FILL}73`;
const BORDER_CONTINUATION = `${FILL}2e`;

/** Short windows (Maghrib is 30 minutes) get one line instead of two. */
const COMPACT_MINUTES = 45;

export function PrayerBands({
  bands,
  isToday,
  minutePx,
}: {
  bands: PrayerBand[];
  isToday: boolean;
  minutePx: number;
}) {
  if (bands.length === 0) return null;

  return (
    <>
      {bands.map((band, index) => (
        <PrayerBandView
          key={`${band.ownerISO}-${band.prayer}-${index}`}
          band={band}
          isToday={isToday}
          minutePx={minutePx}
        />
      ))}
    </>
  );
}

function PrayerBandView({
  band,
  isToday,
  minutePx,
}: {
  band: PrayerBand;
  isToday: boolean;
  minutePx: number;
}) {
  const [, startTransition] = useTransition();
  const nowMinute = useContext(NowContext);

  const minutes = band.endMin - band.startMin;
  const compact = minutes < COMPACT_MINUTES;

  // Checkable only while the window is actually open, and only on today's
  // column. The continuation of last night's Isha is checkable too — at 4 AM
  // it is still this morning's only open prayer — but never from a future
  // day's column, where it is information, not an action.
  const inWindow =
    nowMinute !== null && nowMinute >= band.startMin && nowMinute < band.endMin;
  const canCheck = isToday && !band.checked && inWindow;

  const toggle = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("prayer", band.prayer);
      formData.set("date", band.ownerISO);
      await togglePrayer(formData);
    });
  };

  return (
    <div
      aria-hidden={!canCheck}
      className={cn(
        "pointer-events-none absolute inset-x-0 overflow-hidden border-y",
        band.continuation && "border-dashed",
      )}
      style={{
        top: band.startMin * minutePx,
        height: Math.max(16, minutes * minutePx - 2),
        backgroundColor: band.checked ? FILL_CHECKED : FILL_OPEN,
        borderColor: band.continuation ? BORDER_CONTINUATION : BORDER,
      }}
    >
      <div
        className={cn(
          "flex h-full min-w-0 items-center gap-1.5 px-1.5",
          compact ? "py-0.5" : "py-1",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-micro leading-4 font-medium",
            band.continuation && "text-muted-foreground italic",
            band.checked && "text-muted-foreground",
          )}
        >
          {band.label}
          {!compact && (
            <span className="text-muted-foreground font-normal">
              {" "}
              {formatMinuteOfDay(band.startMin)}
              {band.continuation ? "" : " –"}
            </span>
          )}
        </span>

        {canCheck ? (
          <button
            type="button"
            aria-label={`Mark ${band.label} prayed`}
            title={`Mark ${band.label} prayed`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="pointer-events-auto grid size-4 shrink-0 place-items-center rounded-full border-2 transition-colors hover:border-current"
            style={{ borderColor: BORDER }}
          >
            <Check className="size-2.5 opacity-0 transition-opacity hover:opacity-60" strokeWidth={3} aria-hidden />
          </button>
        ) : (
          band.checked && (
            <span
              className="grid size-4 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: FILL }}
              aria-hidden
            >
              <Check className="size-2.5 text-white" strokeWidth={3} />
            </span>
          )
        )}
      </div>
    </div>
  );
}
