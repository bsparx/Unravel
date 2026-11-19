import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { backfillDefaultAccount, ensureDefaultAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { ensureGlobalCategories } from "@/lib/budget";
import { addMonths, parseLocalDate, startOfMonth, todayLocal, toISODate } from "@/lib/dates";
import { formatMoneyCompact, formatMoneyWhole } from "@/lib/money";
import { getSubscriptions } from "@/lib/subscriptions-data";

import { AccountsStrip } from "./_components/accounts-strip";
import { BudgetsSection } from "./_components/budgets-section";
import { CategoryBars } from "./_components/category-bars";
import { ChartCard } from "./_components/chart-bits";
import { EntryList, LogMoneyButton } from "./_components/entry-list";
import { IousStrip } from "./_components/ious-strip";
import { MonthlyChart } from "./_components/monthly-chart";
import { ResetBudgetsButton } from "./_components/reset-budgets-button";
import { Delta, StatTile } from "./_components/stat-tile";
import { SubscriptionsStrip } from "./_components/subscriptions-strip";
import { foldCategories, monthLedgerHref } from "./_lib/ledger";
import {
  getAccounts,
  getBudgetCategories,
  getBudgetOverview,
  getBudgets,
  getDebtTotals,
  type BudgetOverview,
} from "./_lib/queries";

export const metadata = { title: "Budget" };

/** How many categories "Where it went" names before folding the rest. */
const NAMED_CATEGORIES = 6;

const navLinkClass =
  "focus-visible:ring-ring text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none";

/** What the hero figure means, in one sentence. */
function keptLine(month: BudgetOverview): string {
  const net = month.incomeCents - month.expenseCents;
  if (!month.hasData) return `Nothing logged in ${month.monthLabel}${month.current ? " yet" : ""}.`;
  if (net < 0) return `${formatMoneyCompact(-net)} more went out than came in.`;
  if (month.incomeCents === 0) return "Nothing came in to set it against.";
  if (net === 0) return "Exactly what came in went out.";
  return `You kept ${Math.round((net / month.incomeCents) * 100)}% of what came in.`;
}

/**
 * The budget at a glance: one month's figures, where its money went, the
 * last six months side by side, and a line each for the envelopes, the
 * accounts, the subscriptions and the IOUs. Anything more specific lives a
 * tap away, on Expenses and Income, where it can be searched and narrowed.
 */
export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const today = todayLocal(user.timezone);
  const todayISO = toISODate(today);
  const thisMonth = startOfMonth(today);
  const raw = Array.isArray(params.m) ? params.m[0] : params.m;
  const anchor = raw && /^\d{4}-\d{2}$/.test(raw) ? (parseLocalDate(`${raw}-01`) ?? thisMonth) : thisMonth;

  // Two independent setup steps, side by side. Global categories are the
  // floor every account starts from, and accounts came after the ledger: make
  // sure there's always one to log into, and move any pre-account entry into
  // it. Both are idempotent, a no-op after the first visit.
  await Promise.all([
    ensureGlobalCategories(),
    ensureDefaultAccount(user.id).then((mainAccount) => backfillDefaultAccount(user.id, mainAccount.id)),
  ]);

  const [month, categories, budgets, accounts, debts, subscriptions] = await Promise.all([
    getBudgetOverview(user, anchor, today),
    getBudgetCategories(user),
    getBudgets(user),
    getAccounts(user),
    getDebtTotals(user),
    getSubscriptions(user),
  ]);

  const prev = addMonths(anchor, -1);
  const next = addMonths(anchor, 1);
  const canGoForward = next.getTime() <= thisMonth.getTime();
  const monthName = month.monthLabel.split(" ")[0];
  const net = month.incomeCents - month.expenseCents;
  const { compare } = month;
  const dialog = { accounts, categories, budgets };
  const liveAccounts = accounts.filter((account) => !account.archived);

  const spending = foldCategories(month.spending, NAMED_CATEGORIES, (categoryId) =>
    monthLedgerHref("EXPENSE", month.monthISO, todayISO, categoryId ?? undefined),
  );
  const anyMonths = month.months.some((row) => row.incomeCents + row.expenseCents > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display">Budget</h1>
          <p className="text-muted-foreground mt-1 text-label">
            {month.current ? "This month so far." : `How ${month.monthLabel} went.`}{" "}
            {month.entryCount > 0 &&
              `${month.entryCount} ${month.entryCount === 1 ? "entry" : "entries"} logged.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Month" className="flex items-center">
            <Link href={`/budget?m=${toISODate(prev).slice(0, 7)}`} aria-label="Previous month" className={navLinkClass}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="text-title min-w-32 text-center">{month.monthLabel}</span>
            {canGoForward ? (
              <Link href={`/budget?m=${toISODate(next).slice(0, 7)}`} aria-label="Next month" className={navLinkClass}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="text-muted-foreground/40 grid size-9 place-items-center" aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </nav>
          <LogMoneyButton todayISO={todayISO} {...dialog} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr]">
        <StatTile
          hero
          label={month.current ? "Left over so far" : `Left over in ${monthName}`}
          value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${formatMoneyWhole(Math.abs(net))}`}
          tone={net < 0 ? "bad" : undefined}
          className="sm:col-span-2 lg:col-span-1"
        >
          <p>{keptLine(month)}</p>
          {month.hasData && (
            <Delta
              now={compare.thisIncomeCents - compare.thisExpenseCents}
              then={compare.incomeCents - compare.expenseCents}
              label={compare.label}
              goodWhenUp
            />
          )}
        </StatTile>
        <StatTile label="Came in" value={formatMoneyWhole(month.incomeCents)}>
          <Delta now={compare.thisIncomeCents} then={compare.incomeCents} label={compare.label} goodWhenUp />
          <Link
            href={monthLedgerHref("INCOME", month.monthISO, todayISO)}
            className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            See income
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </StatTile>
        <StatTile label="Went out" value={formatMoneyWhole(month.expenseCents)}>
          <Delta now={compare.thisExpenseCents} then={compare.expenseCents} label={compare.label} goodWhenUp={false} />
          <p>
            {month.daysElapsed > 0 && month.expenseCents > 0
              ? `About ${formatMoneyCompact(Math.round(month.expenseCents / month.daysElapsed))} a day.`
              : month.current
                ? "Nothing spent yet."
                : "Nothing spent."}
          </p>
        </StatTile>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ChartCard
          title="Where it went"
          subtitle={`${monthName}'s spending by category. Tap one to see its entries.`}
          className="lg:col-span-2"
          action={
            <Link
              href={monthLedgerHref("EXPENSE", month.monthISO, todayISO)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              All expenses
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {spending.length > 0 ? (
            <CategoryBars rows={spending} tone="out" label={`${monthName}'s spending by category`} />
          ) : (
            <p className="text-muted-foreground py-10 text-center text-label">Nothing spent in {monthName} yet.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Month by month"
          subtitle="What came in and what went out. Tap a month to open it."
          className="lg:col-span-3"
        >
          {anyMonths ? (
            <MonthlyChart months={month.months} activeStart={month.monthISO} />
          ) : (
            <p className="text-muted-foreground py-10 text-center text-label">
              Six months of in and out will line up here as you log.
            </p>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <BudgetsSection budgets={budgets} accounts={accounts} categories={categories} todayISO={todayISO} />

          <section className="border-border bg-card rounded-lg border">
            <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
              <h2 className="text-title">Latest in {monthName}</h2>
              <div className="flex items-center gap-3 text-label">
                <Link
                  href={monthLedgerHref("INCOME", month.monthISO, todayISO)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Income
                </Link>
                <Link
                  href={monthLedgerHref("EXPENSE", month.monthISO, todayISO)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Expenses
                </Link>
              </div>
            </header>
            {month.recent.length > 0 ? (
              <div className="border-border border-t">
                <EntryList entries={month.recent} showAccount={liveAccounts.length > 1} {...dialog} />
              </div>
            ) : (
              <p className="text-muted-foreground border-border border-t px-4 py-8 text-center text-label md:px-5">
                Money in or out lands here as you log it.
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <AccountsStrip accounts={accounts} />
          <SubscriptionsStrip overview={subscriptions} />
          <IousStrip {...debts} />
        </div>
      </div>

      <footer className="pt-2">
        <ResetBudgetsButton />
      </footer>
    </div>
  );
}
