/**
 * Server-side reads for the budget section.
 *
 * Everything is a plain Prisma read on `MoneyTransaction` bucketed by the
 * house rule — a UTC-midnight local day — so a month is a `gte/lt` pair on
 * two UTC-midnight dates. The overview sums a list it already holds; the
 * income and expense pages, which can span years, let the database add up
 * (`aggregate`, `groupBy`) and only fetch the rows they show. No $queryRaw.
 */

import { GLOBAL_OWNER } from "@/lib/budget";
import { addMonths, formatMonthLabel, parseLocalDate, startOfMonth, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import type { Prisma, User } from "@/lib/generated/prisma/client";
import type { CategoryColor } from "@/lib/money-palette";

import {
  bucketIndex,
  bucketUnit,
  endOfMonth,
  formatMonthLong,
  formatSpan,
  makeBuckets,
  monthStartISO,
  previousSpan,
  resolveSpan,
  shiftMonthsISO,
  spanDays,
  type BucketUnit,
  type LedgerKind,
  type LedgerQuery,
  type Span,
} from "./ledger";

export type BudgetCategory = {
  id: string;
  name: string;
  color: CategoryColor;
  kind: "INCOME" | "EXPENSE";
  /** A seeded built-in — shown with a badge, never archived from the UI. */
  builtIn: boolean;
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

/** An account as a picker needs it: no balance, so no sums to wait for. */
export type AccountOption = Pick<Account, "id" | "name" | "color" | "archived">;

/** One line of the ledger, as every list of entries shows it. */
export type LedgerEntry = {
  id: string;
  date: Date;
  amountCents: number;
  note: string | null;
  category: BudgetCategory;
  /** The envelope this expense counts against, if any. */
  budget: { id: string; name: string } | null;
  /** The account this entry sits in. */
  account: { id: string; name: string; color: CategoryColor } | null;
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

const isoToDate = (iso: string) => parseLocalDate(iso)!;

const CATEGORY_SELECT = {
  id: true,
  name: true,
  color: true,
  kind: true,
  ownerKey: true,
} as const;

/** What a listed entry joins: enough to draw its row and open it for editing. */
const ENTRY_INCLUDE = {
  category: { select: CATEGORY_SELECT },
  budget: { select: { id: true, name: true } },
  account: { select: { id: true, name: true, color: true } },
} as const;

function toCategory(row: {
  id: string;
  name: string;
  color: string;
  kind: "INCOME" | "EXPENSE";
  ownerKey: string;
}): BudgetCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color as CategoryColor,
    kind: row.kind,
    builtIn: row.ownerKey === GLOBAL_OWNER,
  };
}

function toEntry(
  row: Prisma.MoneyTransactionGetPayload<{ include: typeof ENTRY_INCLUDE }>,
): LedgerEntry {
  return {
    id: row.id,
    date: row.date,
    amountCents: row.amountCents,
    note: row.note,
    category: toCategory(row.category),
    budget: row.budget,
    account: row.account
      ? { id: row.account.id, name: row.account.name, color: row.account.color as CategoryColor }
      : null,
  };
}

// ---------------------------------------------------------------- overview

export type BudgetOverview = {
  /** "2026-11-01": the month on show. */
  monthISO: string;
  monthLabel: string;
  /** Whether the month on show is the one running now. */
  current: boolean;
  /** Days of the month gone by: today's date in a running month, all of them in a past one. */
  daysElapsed: number;
  incomeCents: number;
  expenseCents: number;
  /**
   * The same stretch of the month before, for the arrows: the first nineteen
   * days of October against the first nineteen of November, a whole month
   * against a whole month once it's over. `income`/`expense` here are this
   * month's sums over that same stretch, so the two sides are like for like.
   */
  compare: {
    label: string;
    incomeCents: number;
    expenseCents: number;
    thisIncomeCents: number;
    thisExpenseCents: number;
  };
  /** Six months ending with this one, oldest first, for the in-vs-out bars. */
  months: { start: string; tick: string; label: string; incomeCents: number; expenseCents: number }[];
  /** The month's spending by category, biggest first. */
  spending: { category: BudgetCategory; totalCents: number }[];
  /** The month's latest few entries. */
  recent: LedgerEntry[];
  entryCount: number;
  hasData: boolean;
};

/** How many entries the overview lists before pointing at the full pages. */
const RECENT_ROWS = 6;

/**
 * One month at a glance, plus the five before it for the trend: a single read
 * of six months' amounts (small: one row per entry, three columns), summed
 * here, and the few newest entries in full.
 */
export async function getBudgetOverview(
  user: User,
  anchor: Date,
  today: Date,
): Promise<BudgetOverview> {
  const monthISO = toISODate(startOfMonth(anchor));
  const todayISO = toISODate(today);
  const firstISO = monthStartISO(monthISO, -5);
  const month = { gte: isoToDate(monthISO), lt: isoToDate(monthStartISO(monthISO, 1)) };

  const [rows, recent] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, date: { gte: isoToDate(firstISO), lt: month.lt } },
      select: { date: true, amountCents: true, category: { select: CATEGORY_SELECT } },
    }),
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, date: month },
      include: ENTRY_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: RECENT_ROWS,
    }),
  ]);

  const dated = rows.map((row) => ({ ...row, iso: toISODate(row.date) }));
  const sum = (from: string, to: string, kind: LedgerKind) =>
    dated
      .filter((row) => row.category.kind === kind && row.iso >= from && row.iso <= to)
      .reduce((total, row) => total + row.amountCents, 0);

  const monthEnd = endOfMonth(monthISO);
  const current = monthISO === monthStartISO(todayISO);
  const stretchEnd = current ? todayISO : monthEnd;
  const previous = { from: shiftMonthsISO(monthISO, -1), to: shiftMonthsISO(stretchEnd, -1) };

  const months = Array.from({ length: 6 }, (_, i) => {
    const start = monthStartISO(firstISO, i);
    const end = endOfMonth(start);
    const date = isoToDate(start);
    return {
      start,
      tick: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date),
      label: formatMonthLong(start),
      incomeCents: sum(start, end, "INCOME"),
      expenseCents: sum(start, end, "EXPENSE"),
    };
  });

  const byCategory = new Map<string, { category: BudgetCategory; totalCents: number }>();
  let entryCount = 0;
  for (const row of dated) {
    if (row.iso < monthISO) continue;
    entryCount += 1;
    if (row.category.kind !== "EXPENSE") continue;
    const bucket = byCategory.get(row.category.id);
    if (bucket) bucket.totalCents += row.amountCents;
    else byCategory.set(row.category.id, { category: toCategory(row.category), totalCents: row.amountCents });
  }

  const thisMonth = months[months.length - 1];

  return {
    monthISO,
    monthLabel: formatMonthLabel(isoToDate(monthISO)),
    current,
    daysElapsed: Math.max(0, Math.min(spanDays(monthISO, stretchEnd), spanDays(monthISO, monthEnd))),
    incomeCents: thisMonth.incomeCents,
    expenseCents: thisMonth.expenseCents,
    compare: {
      label: formatSpan(previous, todayISO),
      incomeCents: sum(previous.from, previous.to, "INCOME"),
      expenseCents: sum(previous.from, previous.to, "EXPENSE"),
      thisIncomeCents: sum(monthISO, stretchEnd, "INCOME"),
      thisExpenseCents: sum(monthISO, stretchEnd, "EXPENSE"),
    },
    months,
    spending: [...byCategory.values()].sort((a, b) => b.totalCents - a.totalCents),
    recent: recent.map(toEntry),
    entryCount,
    hasData: entryCount > 0,
  };
}

// ---------------------------------------------------------------- ledger

export type LedgerData = {
  /** The days on show. Null only for "all time" with nothing ever logged. */
  span: Span | null;
  /** "November", "Sep – Nov", "All time": what the figures cover. */
  spanLabel: string;
  /** The same in dates, even for all time: "19 Nov – 30 Nov". */
  spanDates: string;
  unit: BucketUnit;
  totalCents: number;
  count: number;
  /** Per day, or per month over long spans; counted to today, not to the span's end. */
  average: { cents: number; per: "day" | "month" } | null;
  biggest: { amountCents: number; title: string; date: Date } | null;
  /** The same stretch one period earlier. Null for all time. */
  compare: { totalCents: number; label: string } | null;
  series: { start: string; end: string; tick: string; label: string; cents: number }[];
  /**
   * Totals by category over the same slice, but ignoring the category filter,
   * so the chart can show the chosen one against the rest.
   */
  byCategory: { category: BudgetCategory; totalCents: number; count: number }[];
  entries: LedgerEntry[];
  hasMore: boolean;
  /** This side's live categories for the filter, and the filtered one if it's since been archived. */
  filterCategories: BudgetCategory[];
  /** Both sides, live only, for the money dialog's In/Out toggle. */
  dialogCategories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  accounts: AccountOption[];
};

const SORT_ORDER: Record<LedgerQuery["sort"], Prisma.MoneyTransactionOrderByWithRelationInput[]> = {
  newest: [{ date: "desc" }, { createdAt: "desc" }],
  oldest: [{ date: "asc" }, { createdAt: "asc" }],
  largest: [{ amountCents: "desc" }, { date: "desc" }],
  smallest: [{ amountCents: "asc" }, { date: "desc" }],
};

/**
 * One side of the ledger, filtered: the totals, the bars over time, the split
 * by category and one page of rows. Every read is scoped to the user, so a
 * foreign category or account id in the URL simply matches nothing.
 */
export async function getLedger(
  user: User,
  kind: LedgerKind,
  query: LedgerQuery,
  todayISO: string,
): Promise<LedgerData> {
  const resolved = resolveSpan(query, todayISO);
  const dateRange = (span: Span) => ({ gte: isoToDate(span.from), lte: isoToDate(span.to) });

  const base: Prisma.MoneyTransactionWhereInput = {
    userId: user.id,
    category: { kind },
    ...(resolved && { date: dateRange(resolved) }),
    ...(query.accountId && { accountId: query.accountId }),
    ...(query.q && {
      OR: [
        { note: { contains: query.q, mode: "insensitive" } },
        { category: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    }),
  };
  const where: Prisma.MoneyTransactionWhereInput = {
    ...base,
    ...(query.categoryId && { categoryId: query.categoryId }),
  };
  const previous = resolved ? previousSpan(query, resolved, todayISO) : null;

  const [totals, biggest, byDate, byCategory, previousTotals, rows, categories, accounts] =
    await Promise.all([
      prisma.moneyTransaction.aggregate({ where, _sum: { amountCents: true }, _count: { _all: true } }),
      prisma.moneyTransaction.findFirst({
        where,
        orderBy: [{ amountCents: "desc" }, { date: "desc" }],
        select: { amountCents: true, note: true, date: true, category: { select: { name: true } } },
      }),
      prisma.moneyTransaction.groupBy({
        by: ["date"],
        where,
        _sum: { amountCents: true },
        orderBy: { date: "asc" },
      }),
      prisma.moneyTransaction.groupBy({
        by: ["categoryId"],
        where: base,
        _sum: { amountCents: true },
        _count: { _all: true },
        orderBy: { _sum: { amountCents: "desc" } },
      }),
      previous
        ? prisma.moneyTransaction.aggregate({
            where: { ...where, date: dateRange(previous) },
            _sum: { amountCents: true },
          })
        : null,
      prisma.moneyTransaction.findMany({
        where,
        include: ENTRY_INCLUDE,
        orderBy: SORT_ORDER[query.sort],
        take: query.limit + 1,
      }),
      prisma.moneyCategory.findMany({
        where: { OR: [{ ownerKey: user.id }, { ownerKey: GLOBAL_OWNER }] },
        orderBy: { sortOrder: "asc" },
        select: { ...CATEGORY_SELECT, archivedAt: true },
      }),
      prisma.moneyAccount.findMany({
        where: { userId: user.id },
        orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, color: true, archivedAt: true },
      }),
    ]);

  // "All time" closes on the first day anything was logged and runs to today
  // (or to the last entry, if one is dated ahead).
  let span = resolved;
  if (!span && byDate.length > 0) {
    const last = toISODate(byDate[byDate.length - 1].date);
    span = { from: toISODate(byDate[0].date), to: last > todayISO ? last : todayISO };
  }

  const unit = span ? bucketUnit(span) : "day";
  const buckets = span ? makeBuckets(span, unit) : [];
  const series = buckets.map((bucket) => ({
    start: bucket.start,
    end: bucket.end,
    tick: bucket.tick,
    label: bucket.label,
    cents: 0,
  }));
  for (const row of byDate) {
    const index = bucketIndex(buckets, toISODate(row.date));
    if (index >= 0) series[index].cents += row._sum.amountCents ?? 0;
  }

  const totalCents = totals._sum.amountCents ?? 0;
  let average: LedgerData["average"] = null;
  if (span && span.from <= todayISO && totalCents > 0) {
    const elapsedTo = span.to > todayISO ? todayISO : span.to;
    if (unit === "month") {
      const months =
        (Number(elapsedTo.slice(0, 4)) - Number(span.from.slice(0, 4))) * 12 +
        (Number(elapsedTo.slice(5, 7)) - Number(span.from.slice(5, 7))) +
        1;
      average = { cents: Math.round(totalCents / months), per: "month" };
    } else {
      average = { cents: Math.round(totalCents / spanDays(span.from, elapsedTo)), per: "day" };
    }
  }

  const lookup = new Map(categories.map((row) => [row.id, toCategory(row)]));
  const live = categories.filter((row) => row.archivedAt === null).map(toCategory);
  const filterCategories = live.filter((category) => category.kind === kind);
  const chosen = query.categoryId ? lookup.get(query.categoryId) : undefined;
  if (chosen && chosen.kind === kind && !filterCategories.some((category) => category.id === chosen.id)) {
    filterCategories.push(chosen);
  }

  return {
    span,
    spanLabel: query.range === "all" ? "All time" : span ? formatSpan(span, todayISO) : "",
    spanDates: span ? formatSpan(span, todayISO) : "",
    unit,
    totalCents,
    count: totals._count._all,
    average,
    biggest: biggest
      ? { amountCents: biggest.amountCents, title: biggest.note || biggest.category.name, date: biggest.date }
      : null,
    compare: previous
      ? { totalCents: previousTotals?._sum.amountCents ?? 0, label: formatSpan(previous, todayISO) }
      : null,
    series,
    byCategory: byCategory.flatMap((row) => {
      const category = lookup.get(row.categoryId);
      return category
        ? [{ category, totalCents: row._sum.amountCents ?? 0, count: row._count._all }]
        : [];
    }),
    entries: rows.slice(0, query.limit).map(toEntry),
    hasMore: rows.length > query.limit,
    filterCategories,
    dialogCategories: {
      income: live.filter((category) => category.kind === "INCOME"),
      expense: live.filter((category) => category.kind === "EXPENSE"),
    },
    accounts: accounts.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color as CategoryColor,
      archived: row.archivedAt !== null,
    })),
  };
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
 * four movements are fetched scoped to a set of accounts (one for the
 * drill-in) or to every account the user has ("all", for the page, which then
 * needn't wait for the account list first) and joined by account id.
 */
async function liveBalances(
  user: User,
  accountIds: string[] | "all",
): Promise<Map<string, number>> {
  if (accountIds !== "all" && accountIds.length === 0) return new Map();
  const scope = accountIds === "all" ? { not: null } : { in: accountIds };
  const transferScope = accountIds === "all" ? undefined : { in: accountIds };

  const [transactions, out, incoming] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, accountId: scope },
      select: {
        accountId: true,
        amountCents: true,
        category: { select: { kind: true } },
      },
    }),
    prisma.accountTransfer.groupBy({
      by: ["fromAccountId"],
      where: { userId: user.id, fromAccountId: transferScope },
      _sum: { amountCents: true },
    }),
    prisma.accountTransfer.groupBy({
      by: ["toAccountId"],
      where: { userId: user.id, toAccountId: transferScope },
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
  const [rows, deltas] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    liveBalances(user, "all"),
  ]);

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
  const start = startOfMonth(anchor);
  const end = addMonths(start, 1);

  // Every read is scoped by user as well as account, so none has to wait for
  // the ownership check: they share its round trip, and a foreign id finds
  // nothing anywhere.
  const [account, transactions, transfers, deltas] = await Promise.all([
    prisma.moneyAccount.findFirst({
      where: { id: accountId, userId: user.id },
    }),
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
    liveBalances(user, [accountId]),
  ]);
  if (!account) return null;

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
  const liveBalanceCents = accountBalance(account, deltas);
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
  // The sums cover every envelope the user has, so they needn't wait for the
  // list; an archived envelope's sum is simply never looked up.
  const [budgets, spent] = await Promise.all([
    prisma.moneyBudget.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { startsOn: "desc" },
    }),
    prisma.moneyTransaction.groupBy({
      by: ["budgetId"],
      where: { userId: user.id, budgetId: { not: null } },
      _sum: { amountCents: true },
    }),
  ]);
  if (budgets.length === 0) return [];
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
  // Both scoped by user, so the entries share the ownership check's round trip.
  const [budget, transactions] = await Promise.all([
    prisma.moneyBudget.findFirst({
      where: { id: budgetId, userId: user.id, archivedAt: null },
    }),
    prisma.moneyTransaction.findMany({
      where: { userId: user.id, budgetId },
      include: {
        category: {
          select: { id: true, name: true, color: true, kind: true, ownerKey: true },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  if (!budget) return null;

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

/**
 * What the IOU ledger stands at, for the overview's one line: the two
 * outstanding totals, summed by the database.
 */
export async function getDebtTotals(user: User): Promise<{
  iOweCents: number;
  owedToMeCents: number;
  open: number;
}> {
  const rows = await prisma.moneyDebt.groupBy({
    by: ["direction"],
    where: { userId: user.id, settledAt: null },
    _sum: { amountCents: true },
    _count: { _all: true },
  });
  const total = (direction: "I_OWE" | "OWED_TO_ME") =>
    rows.find((row) => row.direction === direction)?._sum.amountCents ?? 0;
  return {
    iOweCents: total("I_OWE"),
    owedToMeCents: total("OWED_TO_ME"),
    open: rows.reduce((count, row) => count + row._count._all, 0),
  };
}
