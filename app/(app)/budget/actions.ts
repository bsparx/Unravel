"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { GLOBAL_OWNER } from "@/lib/budget";
import { parseLocalDate, startOfMonth, todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { MAX_AMOUNT_CENTS, parseMoneyToCents } from "@/lib/money";
import { getAccountDetail, getBudgetDetail } from "./_lib/queries";
import {
  archiveMoneyAccountSchema,
  archiveMoneyCategorySchema,
  deleteDebtSchema,
  deleteMoneyAccountSchema,
  deleteMoneyBudgetSchema,
  deleteMoneyTransactionSchema,
  fieldErrorsFrom,
  formValues,
  logTransferSchema,
  moneyAccountSchema,
  moneyBudgetSchema,
  moneyCategorySchema,
  moneyDebtSchema,
  moneyTransactionSchema,
  removeFromBudgetSchema,
  settleDebtSchema,
  settleDebtTransactionSchema,
  type ActionState,
} from "@/lib/validation";

function revalidateBudgetViews() {
  revalidatePath("/budget");
  revalidatePath("/budget/accounts");
  revalidatePath("/budget/categories");
}

/** An account the user may log into: theirs, and not archived. */
async function ownedAccount(userId: string, accountId: string) {
  return prisma.moneyAccount.findFirst({
    where: { id: accountId, userId, archivedAt: null },
    select: { id: true },
  });
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

  const account = await ownedAccount(user.id, parsed.data.accountId);
  if (!account) {
    return { status: "error", message: "Pick an account from the list." };
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
      accountId: account.id,
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

  const account = await ownedAccount(user.id, parsed.data.accountId);
  if (!account) {
    return { status: "error", message: "Pick an account from the list." };
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
      accountId: account.id,
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
 * Rename or re-colour one of the user's own categories. Scoped to
 * `ownerKey: user.id` — a built-in can never be edited from here — and a
 * rename simply relabels the history, because the entries keep the category
 * id.
 */
export async function updateCategory(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyCategorySchema.safeParse(formValues(formData));
  if (!parsed.success || !parsed.data.id) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error),
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
    select: { id: true },
  });
  if (existing && existing.id !== parsed.data.id) {
    return { status: "error", message: "You already have that one." };
  }

  const { count } = await prisma.moneyCategory.updateMany({
    where: { id: parsed.data.id, ownerKey: user.id },
    data: { name: parsed.data.name, color: parsed.data.color },
  });
  if (count === 0) {
    return { status: "error", message: "That category is gone." };
  }

  revalidateBudgetViews();
  return { status: "success", message: "Saved." };
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

// ---------------------------------------------------------------- accounts

export async function createAccount(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const openingCents = parsed.data.openingAmount
    ? parseMoneyToCents(parsed.data.openingAmount)!
    : 0;
  if (openingCents < 0 || openingCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That opening amount is out of range." };
  }

  const existing = await prisma.moneyAccount.findUnique({
    where: { userId_name: { userId: user.id, name: parsed.data.name } },
  });
  if (existing) {
    return { status: "error", message: "You already have that account." };
  }

  const last = await prisma.moneyAccount.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });

  await prisma.moneyAccount.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      openingCents,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });

  revalidateBudgetViews();
  return { status: "success", message: "Account added." };
}

export async function updateAccount(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyAccountSchema.safeParse(formValues(formData));
  if (!parsed.success || !parsed.data.id) {
    return {
      status: "error",
      message: "Some of that didn't look right.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error),
    };
  }

  const openingCents = parsed.data.openingAmount
    ? parseMoneyToCents(parsed.data.openingAmount)!
    : 0;
  if (openingCents < 0 || openingCents > MAX_AMOUNT_CENTS) {
    return { status: "error", message: "That opening amount is out of range." };
  }

  const { count } = await prisma.moneyAccount.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      openingCents,
    },
  });
  if (count === 0) {
    return { status: "error", message: "That account is gone." };
  }

  revalidateBudgetViews();
  return { status: "success", message: "Account saved." };
}

/**
 * Soft-delete, scoped to the user's own rows. An account with history keeps
 * its history — the entries stay where they are, only the picker loses it.
 */
export async function archiveAccount(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = archiveMoneyAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyAccount.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { archivedAt: new Date() },
  });
  revalidateBudgetViews();
}

/**
 * Hard delete, the one-way door the sheet only opens behind a typed
 * confirmation. Archive is for an account whose history should stay; this is
 * for one that should never have existed, or whose past the user has decided
 * they don't want. The entries in it and the transfers that touched it go
 * with it — the account is where that money lived, and keeping the rows would
 * leave history pointing at a place that no longer exists.
 *
 * The delete order satisfies the `Restrict` relations: entries and transfers
 * reference the account, so they go first. Deleting the last live account is
 * allowed — the /budget loader re-creates the default one on the next visit.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteMoneyAccountSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.$transaction(
    [
      prisma.moneyTransaction.deleteMany({
        where: { accountId: parsed.data.id, userId: user.id },
      }),
      prisma.accountTransfer.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { fromAccountId: parsed.data.id },
            { toAccountId: parsed.data.id },
          ],
        },
      }),
      prisma.moneyAccount.deleteMany({
        where: { id: parsed.data.id, userId: user.id },
      }),
    ],
    { timeout: 20_000 },
  );

  revalidateBudgetViews();
}

// ---------------------------------------------------------------- transfers

/**
 * Move money between two of the user's own accounts. One row, two balance
 * deltas — deliberately not an income and an expense, which would show up as
 * money earned and spent in the month's totals when all that happened was the
 * money moved house.
 */
export async function logTransfer(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = logTransferSchema.safeParse(formValues(formData));
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

  const [fromAccount, toAccount] = await Promise.all([
    ownedAccount(user.id, parsed.data.fromAccountId),
    ownedAccount(user.id, parsed.data.toAccountId),
  ]);
  if (!fromAccount || !toAccount) {
    return { status: "error", message: "Pick two of your accounts." };
  }

  const date = parsed.data.date
    ? parseLocalDate(parsed.data.date)
    : todayLocal(user.timezone);
  if (!date) return { status: "error", message: "That date didn't parse." };

  await prisma.accountTransfer.create({
    data: {
      userId: user.id,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amountCents,
      note: parsed.data.note || null,
      date,
    },
  });

  revalidateBudgetViews();
  return { status: "success", message: "Moved." };
}

/** The sheet's read: one account across a month, fetched when it opens. */
export async function getAccountDetailAction(
  accountId: string,
  anchorISO: string,
): Promise<Awaited<ReturnType<typeof getAccountDetail>>> {
  const user = await requireUser();
  const anchor = parseLocalDate(`${anchorISO}-01`) ?? todayLocal(user.timezone);
  return getAccountDetail(user, accountId, startOfMonth(anchor));
}

// ---------------------------------------------------------------- debts

/**
 * An IOU: money promised, not money moved. The counterparty is a name —
 * nothing to re-scope, so after the amount and date checks the write is a
 * straight create scoped to the user.
 */
export async function logDebt(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyDebtSchema.safeParse(formValues(formData));
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

  const date = parsed.data.date
    ? parseLocalDate(parsed.data.date)
    : todayLocal(user.timezone);
  if (!date) return { status: "error", message: "That date didn't parse." };

  await prisma.moneyDebt.create({
    data: {
      userId: user.id,
      direction: parsed.data.direction,
      counterparty: parsed.data.counterparty,
      amountCents,
      note: parsed.data.note || null,
      date,
    },
  });

  revalidateBudgetViews();
  return {
    status: "success",
    message:
      parsed.data.direction === "OWED_TO_ME" ? "Noted — they owe you." : "Noted — you owe them.",
  };
}

export async function updateDebt(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = moneyDebtSchema.safeParse(formValues(formData));
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

  const date = parsed.data.date
    ? parseLocalDate(parsed.data.date)
    : todayLocal(user.timezone);
  if (!date) return { status: "error", message: "That date didn't parse." };

  const { count } = await prisma.moneyDebt.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      direction: parsed.data.direction,
      counterparty: parsed.data.counterparty,
      amountCents,
      note: parsed.data.note || null,
      date,
    },
  });
  if (count === 0) {
    return { status: "error", message: "That IOU is gone." };
  }

  revalidateBudgetViews();
  return { status: "success", message: "Saved." };
}

/**
 * Cross an IOU off. A toggle, not a one-way door: a mis-tap on the settle
 * check is undoable, the same way ticking a task done is.
 */
export async function settleDebt(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = settleDebtSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  const existing = await prisma.moneyDebt.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { settledAt: true },
  });
  if (!existing) return;

  await prisma.moneyDebt.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { settledAt: existing.settledAt ? null : new Date() },
  });
  revalidateBudgetViews();
}

/**
 * Cross an IOU off by logging the money it promised. The ledger entry is the
 * source of truth — if it can't be created, the IOU stays outstanding — so
 * both writes happen in one database transaction.
 */
export async function settleDebtWithTransaction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = settleDebtTransactionSchema.safeParse(formValues(formData));
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

  const account = await ownedAccount(user.id, parsed.data.accountId);
  if (!account) {
    return { status: "error", message: "Pick an account from the list." };
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

  const debt = await prisma.moneyDebt.findFirst({
    where: { id: parsed.data.debtId, userId: user.id },
    select: { direction: true, settledAt: true, counterparty: true },
  });
  if (!debt) {
    return { status: "error", message: "That IOU is gone." };
  }
  if (debt.settledAt) {
    return { status: "error", message: "That IOU is already crossed off." };
  }

  // The dialog locks the In/Out toggle, but the server never trusts the UI:
  // money owed to you comes in, money you owe goes out.
  const expectedKind = debt.direction === "OWED_TO_ME" ? "INCOME" : "EXPENSE";
  if (parsed.data.kind !== expectedKind) {
    return {
      status: "error",
      message: "The money moves the wrong way for this IOU.",
    };
  }

  await prisma.$transaction([
    prisma.moneyTransaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        categoryId: category.id,
        budgetId: budget?.id ?? null,
        amountCents,
        note: parsed.data.note || null,
        date,
      },
    }),
    prisma.moneyDebt.updateMany({
      where: { id: parsed.data.debtId, userId: user.id },
      data: { settledAt: new Date() },
    }),
  ]);

  revalidateBudgetViews();
  return {
    status: "success",
    message:
      parsed.data.kind === "INCOME"
        ? `Settled — ${debt.counterparty} paid up.`
        : "Settled — money out.",
  };
}

/**
 * Hard delete, scoped to the user's own row — an IOU that should never have
 * existed leaves no trace. Settled ones you want gone from the history
 * disappear the same way.
 */
export async function deleteDebt(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteDebtSchema.safeParse(formValues(formData));
  if (!parsed.success) return;

  await prisma.moneyDebt.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  revalidateBudgetViews();
}

// ---------------------------------------------------------------- reset

/**
 * The whole feature back to day zero: every entry, transfer, IOU, envelope,
 * account and custom category for this user, gone in one transaction. The
 * delete order respects the `Restrict` relations — transactions and transfers
 * reference accounts, entries reference categories — so the dependents go
 * first. The built-in categories (`ownerKey: "global"`) are not the user's to
 * delete and stay; the /budget loader re-creates the default account and
 * re-seeds the globals on the next visit, both idempotent no-ops.
 *
 * The typed confirmation in the UI is friction, not security. The guard here
 * is the same one every action in this file trusts: the user's own session,
 * and `userId` scoping on every delete.
 *
 * The raised timeout is the Neon reality: six deletes over the HTTP pooler
 * can spend ~400ms each, and a cold compute start on top would bust Prisma's
 * default 5s transaction budget (P2028) halfway through the wipe.
 */
export async function resetMoneyData(): Promise<void> {
  const user = await requireUser();

  await prisma.$transaction(
    [
      prisma.moneyTransaction.deleteMany({ where: { userId: user.id } }),
      prisma.accountTransfer.deleteMany({ where: { userId: user.id } }),
      prisma.moneyDebt.deleteMany({ where: { userId: user.id } }),
      prisma.moneyBudget.deleteMany({ where: { userId: user.id } }),
      prisma.moneyAccount.deleteMany({ where: { userId: user.id } }),
      prisma.moneyCategory.deleteMany({ where: { ownerKey: user.id } }),
    ],
    { timeout: 20_000 },
  );

  revalidateBudgetViews();
}
