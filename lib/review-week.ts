import { addDays, dayOfWeek, startOfWeek } from "@/lib/dates";

/**
 * The week a review is for. Held on the first day of a week, it plans that
 * week; held any other day, it plans the next one. Pure, so the boundary is
 * checkable without a clock.
 */
export function reviewWeekStart(today: Date, weekStart: number): Date {
  if (dayOfWeek(today) === weekStart) return today;
  return addDays(startOfWeek(today, weekStart), 7);
}
