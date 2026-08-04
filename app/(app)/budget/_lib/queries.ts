/**
 * Server-side reads for the budget section.
 *
 * Everything is a plain Prisma read on `MoneyTransaction` bucketed by the
 * house rule — a UTC-midnight local day — so a month is a `gte/lt` pair on
 * two UTC-midnight dates, and every aggregate here is a sum over a list the
 * page was going to render anyway. No groupBy gymnastics, no $queryRaw.
 */

import { GLOBAL_OWNER } from "@/lib/budget";
import { addMonths, formatMonthLabel, startOfMonth } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { MoneyKind, User } from "@/lib/generated/prisma/client";
import type { CategoryColor } from "@/lib/money-palette";

export type BudgetCategory = {
  id: string;
  name: string;
  color: CategoryColor;
  kind: "INCOME" | "EXPENSE";
  /** A seeded built-in — shown with a badge, never archived from the UI. */
  builtIn: boolean;
};

export type BudgetMonth = {
  /** "2026-08" — the anchor the page links between months by. */
  anchor: string;
  monthLabel: string;
  incomeCents: number;
  expenseCents: number;
  /** The month in week-sized chunks, for the in-vs-out bars. */
  weeks: { label: string; incomeCents: number; expenseCents: number }[];
  /**
   * The running balance, day by day — every day of the month, so the chart
   * axis is complete even before the days arrive.
   */
  balance: { day: number; cents: number }[];
  /**
   * The previous month, for the "ahead of / behind last month" reading.
   * `balance` is indexed by this month's day; days the previous month didn't
   * have (e.g. the 31st of a 30-day month) are null and the line stops.
   */
  lastMonth: {
    incomeCents: number;
    expenseCents: number;
    balance: (number | null)[];
  };
  /** Each category that moved money this month, biggest first. */
  categories: { category: BudgetCategory; totalCents: number }[];
  /** This month's entries, newest first — the full list, not a sample. */
  entries: {
    id: string;
    date: Date;
    amountCents: number;
    note: string | null;
    category: BudgetCategory;
    /** The envelope this expense counts against, if any. */
    budget: { id: string; name: string } | null;
    /** The account this entry sits in. */
    account: { id: string; name: string; color: CategoryColor } | null;
  }[];
  hasData: boolean;
};

export type Account = {
  id: string;
  name: string;
  color: CategoryColor;
  openingCents: number;
  /** opening + income − expenses ± transfers, whatever happened so far. */
  balanceCents: number;
  archived: boolean;
};

export type AccountTransfer = {
  id: string;
  /** The account money left. */
  from: { id: string; name: string; color: CategoryColor };
  /** The account money arrived in. */
  to: { id: string; name: string; color: CategoryColor };
  amountCents: number;
  date: Date;
  note: string | null;
};

/**
 * One account's month: the movements that touched it and what they net to.
 * Income and expenses sit on the ledger; transfers are the money that moved
 * in from or out to the account's siblings.
 */
export type AccountDetail = {
  account: Account;
  monthLabel: string;
  incomeCents: number;
  expenseCents: number;
  /** Transfers out are a separate line so a saved balance reads honestly. */
  transferredOutCents: number;
  /** Transfers in from other accounts. */
  transferredInCents: number;
  runningBalance: { day: number; cents: number }[];
  entries: {
    id: string;
    date: Date;
    amountCents: number;
    note: string | null;
    category: BudgetCategory;
  }[];
  transfers: AccountTransfer[];
};

export type Budget = {
  id: string;
  name: string;
  amountCents: number;
  startsOn: Date;
  endsOn: Date;
  spentCents: number;
  remainingCents: number;
};

export type BudgetDetail = {
  budget: Budget;
  entries: {
    id: string;
    date: Date;
    amountCents: number;
    note: string | null;
    category: BudgetCategory;
  }[];
};

const MS_PER_DAY = 86_400_000;

export async function getBudgetMonth(
  user: User,
  anchor: Date,
): Promise<BudgetMonth> {
  const start = startOfMonth(anchor);
  const end = addMonths(start, 1);

  const transactions = await prisma.moneyTransaction.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    include: {
      category: {
        select: { id: true, name: true, color: true, kind: true, ownerKey: true },
      },
      budget: { select: { id: true, name: true } },
      account: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const entries = transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    amountCents: transaction.amountCents,
    note: transaction.note,
    category: {
      id: transaction.category.id,
      name: transaction.category.name,
      color: transaction.category.color as CategoryColor,
      kind: transaction.category.kind,
      builtIn: transaction.category.ownerKey === GLOBAL_OWNER,
    },
    budget: transaction.budget,
    account: transaction.account
      ? {
          id: transaction.account.id,
          name: transaction.account.name,
          color: transaction.account.color as CategoryColor,
        }
      : null,
  }));

  const sum = (
    list: { amountCents: number; category: { kind: MoneyKind } }[],
    kind: "INCOME" | "EXPENSE",
  ) =>
    list
      .filter((transaction) => transaction.category.kind === kind)
      .reduce((total, transaction) => total + transaction.amountCents, 0);

  const daysInMonth = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  const weeks = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, i) => {
    const first = i * 7 + 1;
    const last = Math.min(first + 6, daysInMonth);
    const list = transactions.filter((transaction) => {
      const day = transaction.date.getUTCDate();
      return day >= first && day <= last;
    });
    return {
      label: first === last ? `${first}` : `${first}–${last}`,
      incomeCents: sum(list, "INCOME"),
      expenseCents: sum(list, "EXPENSE"),
    };
  });

  const balance = dailyBalance(transactions, daysInMonth);

  const prevStart = addMonths(start, -1);
  const prevTransactions = await prisma.moneyTransaction.findMany({
    where: { userId: user.id, date: { gte: prevStart, lt: start } },
    include: { category: { select: { kind: true } } },
  });
  const prevDays = Math.round((start.getTime() - prevStart.getTime()) / MS_PER_DAY);
  const prevBalance = dailyBalance(prevTransactions, prevDays);
  const prevList: (number | null)[] = prevBalance.map((point) => point.cents);
  while (prevList.length < daysInMonth) prevList.push(null);
  prevList.length = daysInMonth;

  const byCategory = new Map<string, { category: BudgetCategory; totalCents: number }>();
  for (const transaction of transactions) {
    const key = transaction.categoryId;
    const bucket = byCategory.get(key);
    if (bucket) {
      bucket.totalCents += transaction.amountCents;
    } else {
      byCategory.set(key, {
        category: {
          id: transaction.category.id,
          name: transaction.category.name,
          color: transaction.category.color as CategoryColor,
          kind: transaction.category.kind,
          builtIn: transaction.category.ownerKey === GLOBAL_OWNER,
        },
        totalCents: transaction.amountCents,
      });
    }
  }

  return {
    anchor: start.toISOString().slice(0, 7),
    monthLabel: formatMonthLabel(start),
    incomeCents: sum(transactions, "INCOME"),
    expenseCents: sum(transactions, "EXPENSE"),
    weeks,
    balance,
    lastMonth: {
      incomeCents: sum(prevTransactions, "INCOME"),
      expenseCents: sum(prevTransactions, "EXPENSE"),
      balance: prevList,
    },
    categories: [...byCategory.values()].sort(
      (a, b) => b.totalCents - a.totalCents,
    ),
    entries,
    hasData: transactions.length > 0,
  };
}

/**
 * The running balance by day of month: income minus expense, accumulated.
 * Every day appears (with the running total carried forward), so the chart
 * axis is complete no matter which days have data yet.
 */
function dailyBalance(
  list: { date: Date; amountCents: number; category: { kind: string } }[],
  daysInMonth: number,
): { day: number; cents: number }[] {
  const byDay = new Map<number, number>();
  for (const transaction of list) {
    const day = transaction.date.getUTCDate();
    const delta =
      transaction.category.kind === "INCOME"
        ? transaction.amountCents
        : -transaction.amountCents;
    byDay.set(day, (byDay.get(day) ?? 0) + delta);
  }

  const points: { day: number; cents: number }[] = [];
  let running = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    running += byDay.get(day) ?? 0;
    points.push({ day, cents: running });
  }
  return points;
}

/**
 * The categories a person can log against, split by side of the ledger. The
 * shared built-ins lead in seed order; your own follow in the order you made
 * them.
 */
export async function getBudgetCategories(user: User): Promise<{
  income: BudgetCategory[];
  expense: BudgetCategory[];
}> {
  const rows = await prisma.moneyCategory.findMany({
    where: {
      archivedAt: null,
      OR: [{ ownerKey: user.id }, { ownerKey: GLOBAL_OWNER }],
    },
    orderBy: { sortOrder: "asc" },
  });

  const groups = { INCOME: [] as BudgetCategory[], EXPENSE: [] as BudgetCategory[] };
  for (const row of rows) {
    groups[row.kind].push({
      id: row.id,
      name: row.name,
      color: row.color as CategoryColor,
      kind: row.kind,
      builtIn: row.ownerKey === GLOBAL_OWNER,
    });
  }

  return { income: groups.INCOME, expense: groups.EXPENSE };
}

// ---------------------------------------------------------------- accounts

/**
 * Where each account's money stands right now: opening balance, plus every
 * income, minus every expense, plus transfers in, minus transfers out. The
 * four movements are fetched scoped to a set of accounts (all of them for the
 * page, one for the drill-in) and joined by account id.
 */
async function liveBalances(
  user: User,
  accountIds: string[],
): Promise<Map<string, number>> {
  if (accountIds.length === 0) return new Map();

  const [transactions, out, incoming] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, accountId: { in: accountIds } },
      select: {
        accountId: true,
        amountCents: true,
        category: { select: { kind: true } },
      },
    }),
    prisma.accountTransfer.groupBy({
      by: ["fromAccountId"],
      where: { userId: user.id, fromAccountId: { in: accountIds } },
      _sum: { amountCents: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ["toAccountId"],
      where: { userId: user.id, toAccountId: { in: accountIds } },
      _sum: { amountCents: true },
    }),
  ]);

  const deltas = new Map<string, number>();
  const add = (key: string, amount: number) =>
    deltas.set(key, (deltas.get(key) ?? 0) + amount);

  for (const row of transactions) {
    const delta =
      row.category.kind === "INCOME" ? row.amountCents : -row.amountCents;
    add(row.accountId!, delta);
  }
  for (const row of out) add(row.fromAccountId, -(row._sum.amountCents ?? 0));
  for (const row of incoming) add(row.toAccountId, row._sum.amountCents ?? 0);

  return deltas;
}

function accountBalance(
  account: { id: string; openingCents: number },
  deltas: Map<string, number>,
): number {
  return account.openingCents + (deltas.get(account.id) ?? 0);
}

/**
 * Every account the user has, sorted with the default first, each carrying a
 * live balance. Same shape as `getBudgets`.
 */
export async function getAccounts(user: User): Promise<Account[]> {
  const rows = await prisma.moneyAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) return [];

  const deltas = await liveBalances(user, rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color as CategoryColor,
    openingCents: row.openingCents,
    balanceCents: accountBalance(row, deltas),
    archived: row.archivedAt !== null,
  }));
}

/**
 * One account across a month: what came in, what went out, what moved between
 * accounts, and the running balance that lands at the month's net.
 */
export async function getAccountDetail(
  user: User,
  accountId: string,
  anchor: Date,
): Promise<AccountDetail | null> {
  const account = await prisma.moneyAccount.findFirst({
    where: { id: accountId, userId: user.id },
  });
  if (!account) return null;

  const start = startOfMonth(anchor);
  const end = addMonths(start, 1);

  const [transactions, transfers] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, accountId, date: { gte: start, lt: end } },
      include: {
        category: {
          select: { id: true, name: true, color: true, kind: true, ownerKey: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.accountTransfer.findMany({
      where: {
        userId: user.id,
        OR: [
          { fromAccountId: accountId, date: { gte: start, lt: end } },
          { toAccountId: accountId, date: { gte: start, lt: end } },
        ],
      },
      include: {
        fromAccount: { select: { id: true, name: true, color: true } },
        toAccount: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const toCategory = (row: (typeof transactions)[number]["category"]) => ({
    id: row.id,
    name: row.name,
    color: row.color as CategoryColor,
    kind: row.kind,
    builtIn: row.ownerKey === GLOBAL_OWNER,
  });

  const incomeCents = transactions
    .filter((t) => t.category.kind === "INCOME")
    .reduce((sum, t) => sum + t.amountCents, 0);
  const expenseCents = transactions
    .filter((t) => t.category.kind === "EXPENSE")
    .reduce((sum, t) => sum + t.amountCents, 0);
  const transferredOutCents = transfers
    .filter((t) => t.fromAccountId === accountId)
    .reduce((sum, t) => sum + t.amountCents, 0);
  const transferredInCents = transfers
    .filter((t) => t.toAccountId === accountId)
    .reduce((sum, t) => sum + t.amountCents, 0);

  const byDay = new Map<number, number>();
  for (const t of transactions) {
    const delta =
      t.category.kind === "INCOME" ? t.amountCents : -t.amountCents;
    byDay.set(t.date.getUTCDate(), (byDay.get(t.date.getUTCDate()) ?? 0) + delta);
  }
  for (const t of transfers) {
    const delta =
      t.fromAccountId === accountId ? -t.amountCents : t.amountCents;
    byDay.set(t.date.getUTCDate(), (byDay.get(t.date.getUTCDate()) ?? 0) + delta);
  }
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  const runningBalance: { day: number; cents: number }[] = [];
  // The month starts where the account was at midnight before day one: the
  // live balance minus whatever moved during this month.
  const liveBalanceCents = accountBalance(
    account,
    await liveBalances(user, [account.id]),
  );
  let running =
    liveBalanceCents -
    (incomeCents - expenseCents - transferredOutCents + transferredInCents);
  for (let day = 1; day <= daysInMonth; day += 1) {
    running += byDay.get(day) ?? 0;
    runningBalance.push({ day, cents: running });
  }

  return {
    account: {
      id: account.id,
      name: account.name,
      color: account.color as CategoryColor,
      openingCents: account.openingCents,
      balanceCents: liveBalanceCents,
      archived: account.archivedAt !== null,
    },
    monthLabel: formatMonthLabel(start),
    incomeCents,
    expenseCents,
    transferredOutCents,
    transferredInCents,
    runningBalance,
    entries: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amountCents: t.amountCents,
      note: t.note,
      category: toCategory(t.category),
    })),
    transfers: transfers.map((t) => ({
      id: t.id,
      from: {
        id: t.fromAccount.id,
        name: t.fromAccount.name,
        color: t.fromAccount.color as CategoryColor,
      },
      to: {
        id: t.toAccount.id,
        name: t.toAccount.name,
        color: t.toAccount.color as CategoryColor,
      },
      amountCents: t.amountCents,
      date: t.date,
      note: t.note,
    })),
  };
}


/**
 * Every envelope the user can see, newest first, with what has been spent
 * against each — a single `groupBy` over the assignments, joined in JS.
 */
export async function getBudgets(user: User): Promise<Budget[]> {
  const budgets = await prisma.moneyBudget.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { startsOn: "desc" },
  });
  if (budgets.length === 0) return [];

  const spent = await prisma.moneyTransaction.groupBy({
    by: ["budgetId"],
    where: {
      userId: user.id,
      budgetId: { in: budgets.map((budget) => budget.id) },
    },
    _sum: { amountCents: true },
  });
  const spentById = new Map(
    spent.map((row) => [row.budgetId, row._sum.amountCents ?? 0]),
  );

  return budgets.map((budget) => {
    const spentCents = spentById.get(budget.id) ?? 0;
    return {
      id: budget.id,
      name: budget.name,
      amountCents: budget.amountCents,
      startsOn: budget.startsOn,
      endsOn: budget.endsOn,
      spentCents,
      remainingCents: budget.amountCents - spentCents,
    };
  });
}

/** One envelope with the expenses assigned to it, newest first. */
export async function getBudgetDetail(
  user: User,
  budgetId: string,
): Promise<BudgetDetail | null> {
  const budget = await prisma.moneyBudget.findFirst({
    where: { id: budgetId, userId: user.id, archivedAt: null },
  });
  if (!budget) return null;

  const transactions = await prisma.moneyTransaction.findMany({
    where: { userId: user.id, budgetId },
    include: {
      category: {
        select: { id: true, name: true, color: true, kind: true, ownerKey: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const spentCents = transactions.reduce(
    (total, transaction) => total + transaction.amountCents,
    0,
  );

  return {
    budget: {
      id: budget.id,
      name: budget.name,
      amountCents: budget.amountCents,
      startsOn: budget.startsOn,
      endsOn: budget.endsOn,
      spentCents,
      remainingCents: budget.amountCents - spentCents,
    },
    entries: transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      amountCents: transaction.amountCents,
      note: transaction.note,
      category: {
        id: transaction.category.id,
        name: transaction.category.name,
        color: transaction.category.color as CategoryColor,
        kind: transaction.category.kind,
        builtIn: transaction.category.ownerKey === GLOBAL_OWNER,
      },
    })),
  };
}

// ---------------------------------------------------------------- debts

export type Debt = {
  id: string;
  direction: "I_OWE" | "OWED_TO_ME";
  /** The person on the other side of the money — a name, not an entity. */
  counterparty: string;
  note: string | null;
  amountCents: number;
  /** When it happened. Local calendar day, UTC-midnight DATE. */
  date: Date;
  settled: boolean;
};

/** One pocket of the IOU ledger. */
export type DebtPocket = {
  /** Outstanding only — settled IOUs have left the total but stay in `rows`. */
  totalCents: number;
  rows: Debt[];
};

/**
 * The IOU ledger, split into the two pockets. One fetch, grouped in JS —
 * the same "sum over a list the page was going to render anyway" rule as
 * the rest of this module. Outstanding first, then newest.
 */
export async function getDebts(user: User): Promise<{
  iOwe: DebtPocket;
  owedToMe: DebtPocket;
}> {
  const rows = await prisma.moneyDebt.findMany({
    where: { userId: user.id },
    orderBy: [{ settledAt: "asc" }, { date: "desc" }, { createdAt: "desc" }],
  });

  const debts: Debt[] = rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    note: row.note,
    amountCents: row.amountCents,
    date: row.date,
    settled: row.settledAt !== null,
  }));

  const pocket = (direction: "I_OWE" | "OWED_TO_ME"): DebtPocket => {
    const list = debts.filter((debt) => debt.direction === direction);
    return {
      totalCents: list
        .filter((debt) => !debt.settled)
        .reduce((total, debt) => total + debt.amountCents, 0),
      rows: list,
    };
  };

  return { iOwe: pocket("I_OWE"), owedToMe: pocket("OWED_TO_ME") };
}
