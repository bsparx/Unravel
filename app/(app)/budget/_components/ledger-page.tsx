import { backfillDefaultAccount, ensureDefaultAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { ensureGlobalCategories } from "@/lib/budget";
import { formatDate, todayLocal, toISODate } from "@/lib/dates";
import { formatMoneyCompact, formatMoneyWhole } from "@/lib/money";

import { CategoryBars } from "./category-bars";
import { ChartCard } from "./chart-bits";
import { EntryList, LogMoneyButton } from "./entry-list";
import { LedgerFilters, ShowMore, SortSelect } from "./ledger-filters";
import { LedgerShell } from "./ledger-shell";
import { OverTimeChart } from "./over-time-chart";
import { Delta, StatTile } from "./stat-tile";
import {
  DEFAULT_QUERY,
  foldCategories,
  ledgerPath,
  ledgerSearch,
  MAX_ROWS,
  PAGE_SIZE,
  parseLedgerQuery,
  type LedgerKind,
} from "../_lib/ledger";
import { getBudgets, getLedger } from "../_lib/queries";

const COPY = {
  INCOME: {
    title: "Income",
    intro: "Everything that came in. Narrow it by dates, category, account or a word from the note.",
    total: "Came in",
    tone: "in",
    log: "Log income",
    byCategory: "Where it came from",
    none: "Nothing came in",
  },
  EXPENSE: {
    title: "Expenses",
    intro: "Everything that went out. Narrow it by dates, category, account or a word from the note.",
    total: "Spent",
    tone: "out",
    log: "Log expense",
    byCategory: "Where it went",
    none: "Nothing went out",
  },
} as const;

/** How many categories the chart names before folding the rest. */
const NAMED_CATEGORIES = 8;

const UNIT_WORD = { day: "day", week: "week", month: "month" } as const;

/**
 * One side of the ledger, to query: the filters, four figures, the bars over
 * time and by category, and the rows themselves. Shared by Income and
 * Expenses; everything it shows is the URL's slice, read on the server.
 */
export async function LedgerPage({
  kind,
  params,
}: {
  kind: LedgerKind;
  params: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const todayISO = toISODate(todayLocal(user.timezone));
  const query = parseLedgerQuery(params);
  const copy = COPY[kind];

  // The same idempotent setup as the overview, for a first visit that lands
  // here directly: categories to pick from and an account to log into.
  await Promise.all([
    ensureGlobalCategories(),
    ensureDefaultAccount(user.id).then((mainAccount) => backfillDefaultAccount(user.id, mainAccount.id)),
  ]);

  const [data, budgets] = await Promise.all([getLedger(user, kind, query, todayISO), getBudgets(user)]);

  const dialog = { accounts: data.accounts, categories: data.dialogCategories, budgets };
  const liveAccounts = data.accounts.filter((account) => !account.archived);
  const path = ledgerPath(kind);
  const byCategory = foldCategories(data.byCategory, NAMED_CATEGORIES, (categoryId) =>
    path +
    ledgerSearch({
      ...query,
      limit: PAGE_SIZE,
      // A tap on the chosen category lets it go again.
      categoryId: categoryId === query.categoryId ? null : categoryId,
    }),
  );
  const chosen = query.categoryId ? data.filterCategories.find((c) => c.id === query.categoryId) : undefined;
  const filtered =
    query.range !== DEFAULT_QUERY.range || query.categoryId !== null || query.accountId !== null || query.q !== "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display">{copy.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-prose text-label">{copy.intro}</p>
        </div>
        <LogMoneyButton kind={kind} label={copy.log} todayISO={todayISO} {...dialog} />
      </header>

      <LedgerShell
        filters={
          <LedgerFilters
            kind={kind}
            query={query}
            span={data.span}
            categories={data.filterCategories}
            accounts={data.accounts}
          />
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              hero
              label={`${copy.total} · ${data.spanLabel}`}
              value={formatMoneyWhole(data.totalCents)}
              className="col-span-2"
            >
              {data.compare ? (
                <Delta
                  now={data.totalCents}
                  then={data.compare.totalCents}
                  label={data.compare.label}
                  goodWhenUp={kind === "INCOME"}
                />
              ) : (
                <p>{chosen ? `${chosen.name}, every entry ever.` : "Every entry ever logged."}</p>
              )}
            </StatTile>
            <StatTile label="Entries" value={data.count.toLocaleString("en-GB")}>
              <p>
                {data.average
                  ? `About ${formatMoneyCompact(data.average.cents)} a ${data.average.per}`
                  : "No average yet"}
              </p>
            </StatTile>
            <StatTile label="Biggest" value={data.biggest ? formatMoneyCompact(data.biggest.amountCents) : "None"}>
              <p className="truncate">
                {data.biggest ? `${data.biggest.title}, ${formatDate(data.biggest.date)}` : "Nothing in this slice"}
              </p>
            </StatTile>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <ChartCard
              title="Over time"
              subtitle={
                data.unit === "day"
                  ? `By ${UNIT_WORD[data.unit]}, ${data.spanDates}`
                  : `By ${UNIT_WORD[data.unit]}, ${data.spanDates}. Tap a bar to see its days.`
              }
              className="lg:col-span-3"
            >
              {data.totalCents > 0 ? (
                <OverTimeChart
                  kind={kind}
                  query={query}
                  series={data.series}
                  average={data.average}
                  unit={data.unit}
                />
              ) : (
                <p className="text-muted-foreground py-16 text-center text-label">
                  {copy.none} {filtered ? "in this slice." : `in ${data.spanDates || "any month"}.`}
                </p>
              )}
            </ChartCard>

            <ChartCard
              title={copy.byCategory}
              subtitle={
                chosen
                  ? `${chosen.name} against the rest. Tap it again to show them all.`
                  : "Tap a category to narrow everything to it."
              }
              className="lg:col-span-2"
            >
              {byCategory.length > 0 ? (
                <CategoryBars
                  rows={byCategory}
                  tone={copy.tone}
                  selectedId={query.categoryId}
                  label={`${copy.title} by category, ${data.spanLabel}`}
                />
              ) : (
                <p className="text-muted-foreground py-16 text-center text-label">Nothing to split yet.</p>
              )}
            </ChartCard>
          </div>

          <section className="border-border bg-card rounded-lg border">
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
              <h2 className="text-title">
                Entries
                {data.count > 0 && <span className="text-muted-foreground"> · {data.count.toLocaleString("en-GB")}</span>}
              </h2>
              {data.count > 1 && <SortSelect kind={kind} query={query} />}
            </header>
            {data.entries.length > 0 ? (
              <div className="border-border border-t">
                <EntryList entries={data.entries} showAccount={liveAccounts.length > 1} {...dialog} />
              </div>
            ) : (
              <p className="text-muted-foreground border-border border-t px-4 py-10 text-center text-label md:px-5">
                {filtered ? "Nothing matches. Try a wider range or clear the filters." : `${copy.none} yet.`}
              </p>
            )}
            {data.hasMore && (
              <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-2 md:px-5">
                <span className="text-muted-foreground text-micro">
                  Showing {data.entries.length} of {data.count.toLocaleString("en-GB")}
                </span>
                {data.entries.length < MAX_ROWS && <ShowMore kind={kind} query={query} shown={data.entries.length} />}
              </div>
            )}
          </section>
        </div>
      </LedgerShell>
    </div>
  );
}
