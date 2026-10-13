import "server-only";

import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import {
  daysUntil,
  isRenewingSoon,
  monthlyCostCents,
  nextRenewal,
  type SubscriptionCycle,
} from "@/lib/subscriptions";

export type SubscriptionView = {
  id: string;
  name: string;
  amountCents: number;
  cycle: SubscriptionCycle;
  /** The stored anchor. Edited in the form as "next renewal". */
  renewsOn: Date;
  accountEmail: string | null;
  remindDaysBefore: number;
  note: string | null;
  cancelled: boolean;
  /** The first renewal on or after today. */
  next: Date;
  daysUntil: number;
  /** Inside its reminder window, and not cancelled. */
  renewingSoon: boolean;
};

export type SubscriptionsOverview = {
  /** Active ones by next renewal, then cancelled ones. */
  rows: SubscriptionView[];
  /** Active subscriptions normalised to a month, summed. */
  monthlyCents: number;
  activeCount: number;
  today: Date;
};

export async function getSubscriptions(
  user: User,
): Promise<SubscriptionsOverview> {
  const today = todayLocal(user.timezone);
  const rows = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: [{ renewsOn: "asc" }, { createdAt: "asc" }],
  });

  const views: SubscriptionView[] = rows.map((row) => {
    const next = nextRenewal(row.renewsOn, row.cycle, today);
    const cancelled = row.cancelledAt !== null;
    return {
      id: row.id,
      name: row.name,
      amountCents: row.amountCents,
      cycle: row.cycle,
      renewsOn: row.renewsOn,
      accountEmail: row.accountEmail,
      remindDaysBefore: row.remindDaysBefore,
      note: row.note,
      cancelled,
      next,
      daysUntil: daysUntil(next, today),
      renewingSoon:
        !cancelled && isRenewingSoon(next, today, row.remindDaysBefore),
    };
  });

  views.sort(
    (a, b) =>
      Number(a.cancelled) - Number(b.cancelled) ||
      a.next.getTime() - b.next.getTime(),
  );

  const active = views.filter((view) => !view.cancelled);
  return {
    rows: views,
    monthlyCents: active.reduce(
      (total, view) => total + monthlyCostCents(view.amountCents, view.cycle),
      0,
    ),
    activeCount: active.length,
    today,
  };
}

/** What /day warns about: active subscriptions inside their window. */
export async function getRenewingSoon(
  user: User,
): Promise<{ rows: SubscriptionView[]; today: Date }> {
  const overview = await getSubscriptions(user);
  return {
    rows: overview.rows.filter((view) => view.renewingSoon),
    today: overview.today,
  };
}
