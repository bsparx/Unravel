"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { parseLocalDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { MAX_AMOUNT_CENTS, parseMoneyToCents } from "@/lib/money";
import {
  fieldErrorsFrom,
  formValues,
  subscriptionIdSchema,
  subscriptionSchema,
  type ActionState,
} from "@/lib/validation";

/** Every surface that reads subscriptions: the page, the /day alert, budget. */
function revalidateSubscriptionViews() {
  revalidatePath("/subscriptions");
  revalidatePath("/day");
  revalidatePath("/days");
  revalidatePath("/budget");
}

type ParsedSubscription =
  | {
      ok: true;
      id?: string;
      data: {
        name: string;
        amountCents: number;
        cycle: "WEEKLY" | "MONTHLY" | "YEARLY";
        renewsOn: Date;
        accountEmail: string | null;
        remindDaysBefore: number;
        note: string | null;
      };
    }
  | { ok: false; state: ActionState };

/** Shared by create and update: the schema, then the amount and date. */
function parseSubscription(formData: FormData): ParsedSubscription {
  const parsed = subscriptionSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Some of that didn't look right.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      },
    };
  }

  const amountCents = parseMoneyToCents(parsed.data.amount)!;
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    return {
      ok: false,
      state: { status: "error", message: "That amount is out of range." },
    };
  }

  const renewsOn = parseLocalDate(parsed.data.renewsOn);
  if (!renewsOn) {
    return {
      ok: false,
      state: { status: "error", message: "That date didn't parse." },
    };
  }

  return {
    ok: true,
    id: parsed.data.id,
    data: {
      name: parsed.data.name,
      amountCents,
      cycle: parsed.data.cycle,
      renewsOn,
      accountEmail: parsed.data.accountEmail ?? null,
      remindDaysBefore: parsed.data.remindDaysBefore,
      note: parsed.data.note || null,
    },
  };
}

export async function createSubscription(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseSubscription(formData);
  if (!parsed.ok) return parsed.state;

  await prisma.subscription.create({
    data: { userId: user.id, ...parsed.data },
  });

  revalidateSubscriptionViews();
  return { status: "success", message: `${parsed.data.name} added.` };
}

export async function updateSubscription(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseSubscription(formData);
  if (!parsed.ok) return parsed.state;
  if (!parsed.id) {
    return { status: "error", message: "Which subscription was that?" };
  }

  const { count } = await prisma.subscription.updateMany({
    where: { id: parsed.id, userId: user.id },
    data: parsed.data,
  });
  if (count === 0) {
    return { status: "error", message: "That subscription is gone." };
  }

  revalidateSubscriptionViews();
  return { status: "success", message: "Saved." };
}

/**
 * Cancel, or bring back. A toggle so a mis-tap is undoable; the row stays
 * either way, because "what was I paying for in March" is worth keeping.
 */
export async function toggleSubscriptionCancelled(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = subscriptionIdSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const existing = await prisma.subscription.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { cancelledAt: true },
  });
  if (!existing) return;

  await prisma.subscription.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { cancelledAt: existing.cancelledAt ? null : new Date() },
  });
  revalidateSubscriptionViews();
}

/** For a subscription that should never have been entered. */
export async function deleteSubscription(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = subscriptionIdSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.subscription.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  revalidateSubscriptionViews();
}
