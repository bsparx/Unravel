import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import { formatDateWithWeekday } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import type { SubscriptionsOverview } from "@/lib/subscriptions-data";
import { cn } from "@/lib/utils";

/**
 * One line pointing at /subscriptions: the monthly cost and what renews
 * next. Clay when something is inside its reminder window.
 */
export function SubscriptionsStrip({
  overview,
}: {
  overview: SubscriptionsOverview;
}) {
  const next = overview.rows.find((row) => !row.cancelled);
  const soon = overview.rows.filter((row) => row.renewingSoon).length;

  return (
    <Link
      href="/subscriptions"
      className={cn(
        "bg-card hover:bg-accent/40 focus-visible:ring-ring mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none",
        soon > 0 ? "border-destructive/30" : "border-border",
      )}
    >
      <CalendarClock
        className={cn(
          "size-4 shrink-0",
          soon > 0 ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="text-title">Subscriptions</span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-label">
        {next ? (
          <>
            <span className="font-mono tabular-nums">
              {formatMoneyCompact(overview.monthlyCents)}
            </span>
            /month.{" "}
            {soon > 0 ? (
              <span className="text-destructive">
                {soon} renewing soon
              </span>
            ) : (
              `Next: ${next.name}, ${formatDateWithWeekday(next.next)}`
            )}
          </>
        ) : (
          "Track what renews and when"
        )}
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}
