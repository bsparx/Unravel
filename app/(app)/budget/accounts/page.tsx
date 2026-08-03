import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { backfillDefaultAccount, ensureDefaultAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import {
  addMonths,
  formatMonthLabel,
  parseLocalDate,
  startOfMonth,
  todayLocal,
} from "@/lib/dates";

import { AccountManager } from "./_components/account-manager";
import { getAccounts } from "../_lib/queries";

export const metadata = { title: "Accounts" };

export default async function BudgetAccountsPage({
  searchParams,
}: PageProps<"/budget/accounts">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const thisMonth = startOfMonth(todayLocal(user.timezone));
  const raw = Array.isArray(params.m) ? params.m[0] : params.m;
  const anchor =
    raw && /^\d{4}-\d{2}$/.test(raw)
      ? (parseLocalDate(`${raw}-01`) ?? thisMonth)
      : thisMonth;

  const mainAccount = await ensureDefaultAccount(user.id);
  await backfillDefaultAccount(user.id, mainAccount.id);

  const accounts = await getAccounts(user);

  const prev = addMonths(anchor, -1);
  const next = addMonths(anchor, 1);
  const canGoForward = next.getTime() <= thisMonth.getTime();
  const monthISO = anchor.toISOString().slice(0, 7);
  const monthLabel = formatMonthLabel(anchor);
  const todayISO = todayLocal(user.timezone).toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/budget"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-6 inline-flex items-center gap-1.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Budget
      </Link>
      <h1 className="text-heading mb-1">Accounts</h1>
      <p className="text-muted-foreground mb-8 text-label">
        Where money lives. Every entry lands in one; a transfer moves it
        between them.
      </p>

      <div className="mb-5 flex items-center justify-end gap-1">
        <nav aria-label="Month" className="flex items-center gap-1">
          <Link
            href={`/budget/accounts?m=${prev.toISOString().slice(0, 7)}`}
            aria-label="Previous month"
            className="focus-visible:ring-ring text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="text-title min-w-28 text-center tabular-nums">
            {monthLabel}
          </span>
          {canGoForward ? (
            <Link
              href={`/budget/accounts?m=${next.toISOString().slice(0, 7)}`}
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
      </div>

      <AccountManager
        accounts={accounts}
        todayISO={todayISO}
        monthISO={monthISO}
      />
    </div>
  );
}