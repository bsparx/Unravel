import {
  formatMinuteOfDay,
  MIN_BLOCK_MINUTES,
  MINUTES_PER_DAY,
  SNAP_MINUTES,
} from "@/lib/block-math";

/** Viewport-relative bounding box of the clicked slot or block. */
export type AnchorRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type WidgetPlacement = "right" | "left" | "center";

export type WidgetPosition = {
  left: number;
  top: number;
  placement: WidgetPlacement;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Compute viewport coordinates for the floating Google Calendar–style widget.
 *
 * Placement priority:
 * 1. To the right of the clicked column/block (Week view left/mid days).
 * 2. To the left of the clicked column/block (Week view right-edge days).
 * 3. Centered over the anchor column (wide full-width Day view), clamped so
 *    the widget always stays fully inside the viewport.
 */
export function computeWidgetPosition({
  anchor,
  card,
  viewport,
  gap = 12,
  margin = 16,
}: {
  anchor: AnchorRect | null;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  gap?: number;
  margin?: number;
}): WidgetPosition {
  const maxLeft = Math.max(margin, viewport.width - margin - card.width);
  const maxTop = Math.max(margin, viewport.height - margin - card.height);

  if (!anchor) {
    return {
      left: clamp(Math.round((viewport.width - card.width) / 2), margin, maxLeft),
      top: clamp(Math.round((viewport.height - card.height) / 2), margin, maxTop),
      placement: "center",
    };
  }

  let left: number;
  let placement: WidgetPlacement;

  if (anchor.right + gap + card.width <= viewport.width - margin) {
    left = Math.round(anchor.right + gap);
    placement = "right";
  } else if (anchor.left - gap - card.width >= margin) {
    left = Math.round(anchor.left - gap - card.width);
    placement = "left";
  } else {
    const anchorCenter = (anchor.left + anchor.right) / 2;
    left = clamp(Math.round(anchorCenter - card.width / 2), margin, maxLeft);
    placement = "center";
  }

  const top = clamp(Math.round(anchor.top - 24), margin, maxTop);

  return { left, top, placement };
}

/**
 * Every 15-minute slot in the day (`00:00`..`23:45`), plus `currentStart`
 * sorted in place when an existing block starts off the 15-minute grid.
 */
export function startTimeOptions(currentStart: number): number[] {
  const values = new Set<number>();
  for (let m = 0; m <= MINUTES_PER_DAY - SNAP_MINUTES; m += SNAP_MINUTES) {
    values.add(m);
  }
  if (
    Number.isInteger(currentStart) &&
    currentStart >= 0 &&
    currentStart <= MINUTES_PER_DAY - MIN_BLOCK_MINUTES
  ) {
    values.add(currentStart);
  }
  return [...values].sort((a, b) => a - b);
}

/**
 * Every 15-minute increment after `start` up to `24:00` (`1440`), plus
 * `currentEnd` if valid and off-grid. Stepping relative to `start` makes the
 * inline duration hints (`15m`, `30m`, `45m`, `1h`…) land on clean lengths,
 * matching Google Calendar's end-time picker.
 */
export function endTimeOptions(start: number, currentEnd: number): number[] {
  const values = new Set<number>();
  for (let m = start + SNAP_MINUTES; m <= MINUTES_PER_DAY; m += SNAP_MINUTES) {
    values.add(m);
  }
  if (start + MIN_BLOCK_MINUTES <= MINUTES_PER_DAY) {
    values.add(MINUTES_PER_DAY);
  }
  if (
    Number.isInteger(currentEnd) &&
    currentEnd >= start + MIN_BLOCK_MINUTES &&
    currentEnd <= MINUTES_PER_DAY
  ) {
    values.add(currentEnd);
  }
  return [...values].sort((a, b) => a - b);
}

/** `"24:00"` for end-of-day midnight so it never reads like `"00:00"` start. */
export function formatEndMinuteLabel(minute: number): string {
  return minute >= MINUTES_PER_DAY ? "24:00" : formatMinuteOfDay(minute);
}

/**
 * Bridge a calendar ISO string (`"2026-11-20"`) to a local `Date` for
 * `react-day-picker` without UTC-midnight off-by-one shifts.
 */
export function isoToPickerDate(dateISO: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Convert a local `Date` picked in `react-day-picker` back to `"YYYY-MM-DD"`. */
export function pickerDateToISO(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
