import { requireUser } from "@/lib/auth";
import { formatDateWithWeekday, toISODate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import {
  getSubscriptions,
  type SubscriptionsOverview,
} from "@/lib/subscriptions-data";

import { SubscriptionList } from "./_components/subscription-list";

export const metadata = { title: "Subscriptions" };

/** One plain sentence: what it all costs a month, and what's next. */
function headline(overview: SubscriptionsOverview): string {
  if (overview.activeCount === 0) {
    return overview.rows.length === 0
      ? "Track what renews, what it costs, and which account it's on."
      : "Nothing active right now.";
  }
  const count = `${overview.activeCount} subscription${overview.activeCount === 1 ? "" : "s"}`;
  const next = overview.rows[0];
  return `About ${formatMoneyCompact(overview.monthlyCents)} a month across ${count}. Next up: ${next.name}, ${formatDateWithWeekday(next.next)}.`;
}

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const overview = await getSubscriptions(user);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <SubscriptionList
        rows={overview.rows}
        todayISO={toISODate(overview.today)}
        headline={headline(overview)}
      />
    </div>
  );
}
