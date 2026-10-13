import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { renewalLabel } from "@/lib/subscriptions";
import type { SubscriptionView } from "@/lib/subscriptions-data";
import { cn } from "@/lib/utils";

/**
 * Subscriptions inside their reminder window, at the top of the day. Clay,
 * the palette's "thing to notice". Nothing renders when nothing is due, so
 * on an ordinary day the page doesn't change shape.
 */
export function RenewalsAlert({
  rows,
  today,
}: {
  rows: SubscriptionView[];
  today: Date;
}) {
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="renewals-alert"
      className="border-destructive/30 bg-destructive/5 mb-8 rounded-lg border"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <h2
          id="renewals-alert"
          className="text-destructive flex items-center gap-2 text-label font-medium"
        >
          <CalendarClock className="size-4" aria-hidden />
          {rows.length === 1 ? "Renewing soon" : `${rows.length} renewing soon`}
        </h2>
        <Link
          href="/subscriptions"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Manage
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      <ul className="divide-destructive/15 divide-y px-4 pb-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="text-title block truncate">{row.name}</span>
              {row.accountEmail && (
                <span className="text-muted-foreground block truncate text-micro">
                  {row.accountEmail}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-title tabular-nums">
                {formatMoney(row.amountCents)}
              </span>
              <span
                className={cn(
                  "block text-micro",
                  row.daysUntil <= 1
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                {renewalLabel(row.next, today)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
