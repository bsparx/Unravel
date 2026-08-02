"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { GLOBAL_OWNER } from "@/lib/budget";
import { parseLocalDate, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { MAX_AMOUNT_CENTS, parseMoneyToCents } from "@/lib/money";
import { getBudgetDetail } from "./_lib/queries";
import {
  archiveMoneyCategorySchema,
  deleteMoneyBudgetSchema,
  deleteMoneyTransactionSchema,
  fieldErrorsFrom,
  formValues,
  moneyBudgetSchema,
  moneyCategorySchema,
  moneyTransactionSchema,
  removeFromBudgetSchema,
  type ActionState,
} from "@/lib/validation";

function revalidateBudgetViews() {
  revalidatePath("/budget");
  revalidatePath("/budget/categories");
}

/**
 * A category the user may log against: their own, or a built-in — on the
 * given side of the ledger, and not archived. Returning the id keeps the
 * caller from ever trusting the raw categoryId.
 */
async function ownedCategory(
  userId: string,
  categoryId: string,
  kind: "INCOME" | "EXPENSE",
) {
  return prisma.moneyCategory.findFirst({
    where: {
      id: categoryId,
      kind,
      archivedAt: null,
      OR: [{ ownerKey: userId }, { ownerKey: GLOBAL_OWNER }],
    },
    select: { id: true },
  });
}

/**
 * An envelope the user may assign an expense dated `date` to: theirs, not
 * archived, and the expense's date must fall inside the budget's range.
 */
async function ownedBudget(userId: string, budgetId: string, date: Date) {
  return prisma.moneyBudget.findFirst({
    where: {
      id: budgetId,
      userId,
      archivedAt: null,
      startsOn: { lte: date },
      endsOn: { gte: date },
    },
    select: { id: true },
  });
}

// ---------------------------------------------------------------- transactions

export async function logTransaction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyTransactionSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const amountCents = parseMoneyToCents(parsed.data.amount)!;
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That amount is out of range." };
  }

  const category = await ownedCategory(
    user.id,
    parsed.data.categoryId,
    parsed.data.kind,
  );
  if (!category) {
    return { status: "error", message: "Pick a category from the list." };
  }

  const date = parsed.data.date
    ? parseLocalDate(parsed.data.date)
    : todayLocal(user.timezone);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const budget = parsed.data.budgetId
    ? await ownedBudget(user.id, parsed.data.budgetId, date)
    : null;
  if (parsed.data.budgetId && !budget) {
    return {
      status: "error",
      message: "That budget doesn't cover this date.",
      fieldErrors: { budgetId: "Pick a budget that covers the date, or no budget." },
    };
  }

  await prisma.moneyTransaction.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      budgetId: budget?.id ?? null,
      amountCents,
      note: parsed.data.note || null,
      date,
    },
  });

  revalidateBudgetViews();
  return {
    status: "success",
    message: parsed.data.kind === "INCOME" ? "Money in." : "Logged.",
  };
}

export async function updateTransaction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyTransactionSchema.safeParse(formValues(formData));
  if (!parsed.success || !parsed.data.id) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error),
    };
  }

  const amountCents = parseMoneyToCents(parsed.data.amount)!;
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That amount is out of range." };
  }

  const category = await ownedCategory(
    user.id,
    parsed.data.categoryId,
    parsed.data.kind,
  );
  if (!category) {
    return { status: "error", message: "Pick a category from the list." };
  }

  const date = parsed.data.date
    ? parseLocalDate(parsed.data.date)
    : todayLocal(user.timezone);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const budget = parsed.data.budgetId
    ? await ownedBudget(user.id, parsed.data.budgetId, date)
    : null;
  if (parsed.data.budgetId && !budget) {
    return {
      status: "error",
      message: "That budget doesn't cover this date.",
      fieldErrors: { budgetId: "Pick a budget that covers the date, or no budget." },
    };
  }

  const { count } = await prisma.moneyTransaction.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      categoryId: category.id,
      budgetId: budget?.id ?? null,
      amountCents,
      note: parsed.data.note || null,
      date,
    },
  });
  if (count === 0) {
    return { status: "error", message: "That entry is gone." };
  }

  revalidateBudgetViews();
  return { status: "success", message: "Saved." };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteMoneyTransactionSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyTransaction.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  revalidateBudgetViews();
}

// ---------------------------------------------------------------- categories

export async function createCategory(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyCategorySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const existing = await prisma.moneyCategory.findUnique({
    where: {
      ownerKey_kind_name: {
        ownerKey: user.id,
        kind: parsed.data.kind,
        name: parsed.data.name,
      },
    },
  });
  if (existing) {
    return { status: "error", message: "You already have that one." };
  }

  const last = await prisma.moneyCategory.aggregate({
    where: { ownerKey: user.id },
    _max: { sortOrder: true },
  });

  await prisma.moneyCategory.create({
    data: {
      ownerKey: user.id,
      userId: user.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      color: parsed.data.color,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });

  revalidateBudgetViews();
  return { status: "success", message: "Category added." };
}

/**
 * Soft-delete, scoped to the user's own rows — a built-in can never be
 * archived from here, and a category with history keeps its history.
 */
export async function archiveCategory(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = archiveMoneyCategorySchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyCategory.updateMany({
    where: { id: parsed.data.id, ownerKey: user.id },
    data: { archivedAt: new Date() },
  });
  revalidateBudgetViews();
}

// ---------------------------------------------------------------- budgets

export async function createBudget(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyBudgetSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const amountCents = parseMoneyToCents(parsed.data.amount)!;
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That amount is out of range." };
  }

  const startsOn = parseLocalDate(parsed.data.startsOn);
  const endsOn = parseLocalDate(parsed.data.endsOn);
  if (!startsOn || !endsOn) {
    return { status: "error", message: "Those dates didn't parse." };
  }

  await prisma.moneyBudget.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      amountCents,
      startsOn,
      endsOn,
    },
  });

  revalidateBudgetViews();
  return { status: "success", message: "Budget created." };
}

export async function updateBudget(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyBudgetSchema.safeParse(formValues(formData));
  if (!parsed.success || !parsed.data.id) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error),
    };
  }

  const amountCents = parseMoneyToCents(parsed.data.amount)!;
  if (amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That amount is out of range." };
  }

  const startsOn = parseLocalDate(parsed.data.startsOn);
  const endsOn = parseLocalDate(parsed.data.endsOn);
  if (!startsOn || !endsOn) {
    return { status: "error", message: "Those dates didn't parse." };
  }

  const [updated, unassigned] = await prisma.$transaction([
    prisma.moneyBudget.updateMany({
      where: { id: parsed.data.id, userId: user.id },
      data: { name: parsed.data.name, amountCents, startsOn, endsOn },
    }),
    // Expenses that no longer fall inside the range stop counting — their
    // transaction stays, only the assignment goes.
    prisma.moneyTransaction.updateMany({
      where: {
        userId: user.id,
        budgetId: parsed.data.id,
        OR: [{ date: { lt: startsOn } }, { date: { gt: endsOn } }],
      },
      data: { budgetId: null },
    }),
  ]);
  if (updated.count === 0) {
    return { status: "error", message: "That budget is gone." };
  }

  revalidateBudgetViews();
  return {
    status: "success",
    message:
      unassigned.count > 0
        ? `Saved. ${unassigned.count} expense${unassigned.count === 1 ? "" : "s"} fell outside the new dates and were unassigned.`
        : "Saved.",
  };
}

/**
 * Hard delete, with the transactions surviving: the relation is `SetNull`, so
 * deleting an envelope simply unassigns its expenses.
 */
export async function deleteBudget(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteMoneyBudgetSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyBudget.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  revalidateBudgetViews();
}

/** Unassign an expense without touching the transaction itself. */
export async function removeTransactionFromBudget(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = removeFromBudgetSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyTransaction.updateMany({
    where: { id: parsed.data.id, userId: user.id, budgetId: { not: null } },
    data: { budgetId: null },
  });
  revalidateBudgetViews();
}

/**
 * The sheet's read: the envelope and the expenses in it, fetched when the
 * sheet opens so the section itself stays a plain list.
 */
export async function getBudgetDetailAction(
  budgetId: string,
): Promise<Awaited<ReturnType<typeof getBudgetDetail>>> {
  const user = await requireUser();
  return getBudgetDetail(user, budgetId);
}
