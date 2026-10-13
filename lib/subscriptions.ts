/**
 * Subscription renewal math. Pure, so `pnpm verify` can exercise it.
 *
 * A subscription stores one known renewal day (the anchor) and a cycle. Every
 * later renewal is derived from that pair, never stored, so a subscription
 * can't go stale after it renews.
 *
 * All dates are LocalDates: the user's calendar day at UTC midnight.
 */

import { addDays, diffInDays, formatDateWithWeekday } from "@/lib/dates";

export type SubscriptionCycle = "WEEKLY" | "MONTHLY" | "YEARLY";

export const SUBSCRIPTION_CYCLES: SubscriptionCycle[] = [
  "MONTHLY",
  "YEARLY",
  "WEEKLY",
];

/** The longest reminder window the form accepts, in days. */
export const MAX_REMIND_DAYS = 90;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * `anchor` moved `months` months on, keeping its day-of-month where the
 * target month has it and clamping where it doesn't (31 Jan + 1 = 28 Feb).
 * Always computed from the anchor, so 31 Jan + 2 is 31 Mar, not 28 Mar.
 */
function shiftMonths(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(
    anchor.getUTCDate(),
    daysInMonth(targetYear, targetMonth),
  );
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

/** The first renewal on or after `today`: `anchor + n cycles`, n >= 0. */
export function nextRenewal(
  anchor: Date,
  cycle: SubscriptionCycle,
  today: Date,
): Date {
  if (anchor.getTime() >= today.getTime()) return anchor;

  if (cycle === "WEEKLY") {
    const weeks = Math.ceil(diffInDays(today, anchor) / 7);
    return addDays(anchor, weeks * 7);
  }

  const step = cycle === "YEARLY" ? 12 : 1;
  const monthsApart =
    (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - anchor.getUTCMonth());
  // Start one step short of the estimate and walk forward: clamping can put
  // a renewal a few days earlier than the anchor's day-of-month.
  let n = Math.max(0, Math.floor(monthsApart / step) - 1);
  let next = shiftMonths(anchor, n * step);
  while (next.getTime() < today.getTime()) {
    n += 1;
    next = shiftMonths(anchor, n * step);
  }
  return next;
}

/** Whole days from `today` to `next`. 0 means it renews today. */
export function daysUntil(next: Date, today: Date): number {
  return diffInDays(next, today);
}

/** Inside the reminder window: today counts, `remindDaysBefore` out counts. */
export function isRenewingSoon(
  next: Date,
  today: Date,
  remindDaysBefore: number,
): boolean {
  const days = daysUntil(next, today);
  return days >= 0 && days <= remindDaysBefore;
}

/** The price as a monthly figure, for the page's running total. */
export function monthlyCostCents(
  amountCents: number,
  cycle: SubscriptionCycle,
): number {
  if (cycle === "WEEKLY") return Math.round((amountCents * 52) / 12);
  if (cycle === "YEARLY") return Math.round(amountCents / 12);
  return amountCents;
}

export function describeCycle(cycle: SubscriptionCycle): string {
  if (cycle === "WEEKLY") return "Weekly";
  if (cycle === "YEARLY") return "Yearly";
  return "Monthly";
}

/** "Today" / "Tomorrow" / "in 4 days" / "Fri 17 Oct" for a coming renewal. */
export function renewalLabel(next: Date, today: Date): string {
  const days = daysUntil(next, today);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `in ${days} days`;
  return formatDateWithWeekday(next);
}
