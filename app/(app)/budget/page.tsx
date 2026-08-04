import Link from "next/link";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Wallet } from "lucide-react";

import { backfillDefaultAccount, ensureDefaultAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { ensureGlobalCategories } from "@/lib/budget";
import {
  addMonths,
  parseLocalDate,
  startOfMonth,
  todayLocal,
} from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";

import { AccountsStrip } from "./_components/accounts-strip";
import { BalanceChart } from "./_components/balance-chart";
import { BalancePanel } from "./_components/balance-panel";
import { BudgetsSection } from "./_components/budgets-section";
import { CategoryDonut } from "./_components/category-donut";
import { DebtsSection } from "./_components/debts-section";
import { FlowChart } from "./_components/flow-chart";
import { TransactionsSection } from "./_components/transactions-section";
import {
  getAccounts,
  getBudgetCategories,
  getBudgetMonth,
  getBudgets,
  getDebts,
} from "./_lib/queries";
import type { BudgetMonth } from "./_lib/queries";

export const metadata = { title: "Budget" };

/**
 * The headline sentence, computed server-side — same licence as the
 * calendar's: Server Components don't re-render, so there is nothing to
 * hydrate-mismatch. One sentence, one piece of arithmetic, and it's done
 * for you.
 */
function headline(month: BudgetMonth): string {
  const net = month.incomeCents - month.expenseCents;
  const spent = formatMoneyCompact(month.expenseCents);
  const earned = formatMoneyCompact(month.incomeCents);

  if (net === 0) {
    return `In ${month.monthLabel} you spent ${spent} and brought in ${earned} — exactly even.`;
  }
  const direction = net > 0 ? "ahead" : "behind";
  return `In ${month.monthLabel} you spent ${spent} and brought in ${earned} — ${formatMoneyCompact(Math.abs(net))} ${direction}.`;
}

/**
 * The pace sentence: this month's balance at this point against the same
 * stretch of last month. For a past month, the whole-month comparison.
 * Null when there is nothing to compare against — silence is better than
 * a made-up number.
 */
function paceSentence(
  month: BudgetMonth,
  lastMonth: BudgetMonth["lastMonth"],
  anchor: Date,
  today: Date,
): string | null {
  if (!month.hasData || lastMonth.incomeCents + lastMonth.expenseCents === 0) {
    return null;
  }

  const isCurrent = anchor.getUTCMonth() === today.getUTCMonth();
  const elapsed = isCurrent
    ? today.getUTCDate()
    : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))
        .getUTCDate();

  const idx = Math.min(elapsed, month.balance.length, lastMonth.balance.length) - 1;
  if (idx < 0) return null;

  const mine = month.balance[idx]?.cents ?? 0;
  let theirs: number | null = null;
  for (let i = idx; i >= 0; i--) {
    if (lastMonth.balance[i] !== null) {
      theirs = lastMonth.balance[i];
      break;
    }
  }
  if (theirs === null) return null;

  const diff = mine - theirs;
  if (diff === 0) return null;
  const amount = formatMoneyCompact(Math.abs(diff));
  const ahead = diff > 0 ? "ahead of" : "behind";

  return isCurrent
    ? `This far into ${month.monthLabel} you&apos;re ${amount} ${ahead} the same stretch last month.`
    : `${month.monthLabel} finished ${amount} ${ahead} the month before it.`;
}

export default async function BudgetPage({
  searchParams,
}: PageProps<"/budget">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const thisMonth = startOfMonth(todayLocal(user.timezone));
  const raw = Array.isArray(params.m) ? params.m[0] : params.m;
  const anchor =
    raw && /^\d{4}-\d{2}$/.test(raw)
      ? (parseLocalDate(`${raw}-01`) ?? thisMonth)
      : thisMonth;

  // Global categories are the floor every account starts from. Idempotent —
  // a no-op after the first visit.
  await ensureGlobalCategories();

  // Accounts came after the ledger: make sure there's always one to log into,
  // and move any pre-account entry into it.
  const mainAccount = await ensureDefaultAccount(user.id);
  await backfillDefaultAccount(user.id, mainAccount.id);

  const [month, categories, budgets, accounts, debts] = await Promise.all([
    getBudgetMonth(user, anchor),
    getBudgetCategories(user),
    getBudgets(user),
    getAccounts(user),
    getDebts(user),
  ]);

  const prev = addMonths(anchor, -1);
  const next = addMonths(anchor, 1);
  const canGoForward = next.getTime() <= thisMonth.getTime();

  const today = todayLocal(user.timezone);
  const todayISO = today.toISOString().slice(0, 10);
  const last = month.lastMonth;
  const deltaIncome = month.incomeCents - last.incomeCents;
  const deltaOut = month.expenseCents - last.expenseCents;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display">Budget</h1>
          <p className="text-muted-foreground mt-1 text-label">
            {month.hasData
              ? headline(month)
              : `Nothing logged in ${month.monthLabel} yet.`}
          </p>
        </div>

        <nav aria-label="Month" className="flex items-center gap-1">
          <Link
            href={`/budget?m=${prev.toISOString().slice(0, 7)}`}
            aria-label="Previous month"
            className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="text-title min-w-28 text-center tabular-nums">
            {month.monthLabel}
          </span>
          {canGoForward ? (
            <Link
              href={`/budget?m=${next.toISOString().slice(0, 7)}`}
              aria-label="Next month"
              className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className="text-muted-foreground/40 p-1.5" aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </nav>
      </header>

      <BalancePanel
        incomeCents={month.incomeCents}
        expenseCents={month.expenseCents}
        deltaIncome={deltaIncome}
        deltaOut={deltaOut}
        monthLabel={month.monthLabel}
        paceLine={paceSentence(month, last, anchor, today)}
        hasData={month.hasData}
      />

      <AccountsStrip accounts={accounts} />

      {month.hasData && (
        <>
          <section className="border-border bg-card mb-6 rounded-lg border p-4">
            <h2 className="text-title mb-3">The month&apos;s stretch</h2>
            <BalanceChart
              balance={month.balance}
              lastMonth={last.balance}
              monthName={month.monthLabel.split(" ")[0]}
            />
          </section>

          <BudgetsSection
            budgets={budgets}
            accounts={accounts}
            categories={categories}
            todayISO={todayISO}
          />

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <section className="border-border bg-card rounded-lg border p-4">
              <h2 className="text-title mb-3">In vs out</h2>
              <FlowChart weeks={month.weeks} />
            </section>
            <section className="border-border bg-card rounded-lg border p-4">
              <h2 className="text-title mb-3">By category</h2>
              <CategoryDonut categories={month.categories} />
            </section>
          </div>
        </>
      )}

      <DebtsSection
        debts={debts}
        accounts={accounts}
        categories={categories}
        budgets={budgets}
        todayISO={todayISO}
      />

      <TransactionsSection
        entries={month.entries}
        accounts={accounts}
        categories={categories}
        budgets={budgets}
        monthLabel={month.monthLabel}
        todayISO={todayISO}
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          href="/budget/accounts"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Wallet className="size-4" aria-hidden />
          Accounts
        </Link>
        <Link
          href="/budget/categories"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Manage categories
        </Link>
      </div>
    </div>
  );
}
