/**
 * The windows of the waking day a habit can belong to. Pure functions — no
 * Prisma, no React.
 *
 * A slot is a visibility rule, not a due rule: the habit is still owed on its
 * days, it just stops being *offered* outside its windows. /day and the
 * calendar's scheduling panel read this; /habits shows everything and wears
 * the slot as a badge.
 */

import type { HabitSlot } from "@/lib/generated/prisma/client";

/**
 * Minutes from local midnight, start inclusive / end exclusive — 720 (noon)
 * belongs to AFTERNOON, 1020 (17:00) to EVENING, 1260 (21:00) to no window at
 * all. The night gap is deliberate: outside the windows a slot-filtered habit
 * is hidden, which is the whole point of picking a window.
 */
export const SLOT_WINDOWS: Record<
  Exclude<HabitSlot, "ALWAYS">,
  { startMinute: number; endMinute: number; label: string }
> = {
  MORNING: { startMinute: 5 * 60, endMinute: 12 * 60, label: "Morning" },
  AFTERNOON: { startMinute: 12 * 60, endMinute: 17 * 60, label: "Afternoon" },
  EVENING: { startMinute: 17 * 60, endMinute: 21 * 60, label: "Evening" },
};

/** Order for badges and the form. */
export const SLOT_ORDER: Exclude<HabitSlot, "ALWAYS">[] = [
  "MORNING",
  "AFTERNOON",
  "EVENING",
];

/**
 * Is the habit offered at `minute`? ALWAYS passes unconditionally — it is a
 * value of its own, not shorthand for all three windows. An empty array is
 * treated as never active; the form and validation never write it.
 */
export function isActiveInSlot(slots: HabitSlot[], minute: number): boolean {
  if (slots.includes("ALWAYS")) return true;

  return slots.some((slot) => {
    const window = SLOT_WINDOWS[slot as Exclude<HabitSlot, "ALWAYS">];
    if (!window) return false;
    return minute >= window.startMinute && minute < window.endMinute;
  });
}

/**
 * The badge text: "Always", or the selected windows joined — "Morning ·
 * Evening". Used on the /habits cards and the form's summary.
 */
export function describeSlots(slots: HabitSlot[]): string {
  if (slots.length === 0 || slots.includes("ALWAYS")) return "Always";

  return SLOT_ORDER.filter((slot) => slots.includes(slot))
    .map((slot) => SLOT_WINDOWS[slot].label)
    .join(" · ");
}
