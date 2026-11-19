import { backfillDefaultAccount, ensureDefaultAccount } from "@/lib/accounts";
import { requireUser } from "@/lib/auth";
import { ensureGlobalCategories } from "@/lib/budget";
import { todayLocal, toISODate } from "@/lib/dates";

import { DebtsSection } from "../_components/debts-section";
import { getAccounts, getBudgetCategories, getBudgets, getDebts } from "../_lib/queries";

export const metadata = { title: "IOUs" };

/**
 * The IOU ledger on its own page: money promised before it moves. Crossing
 * one off logs the money, which is why it needs the accounts, categories and
 * envelopes the money dialog picks from.
 */
export default async function BudgetDebtsPage() {
  const user = await requireUser();
  await Promise.all([
    ensureGlobalCategories(),
    ensureDefaultAccount(user.id).then((mainAccount) => backfillDefaultAccount(user.id, mainAccount.id)),
  ]);

  const [debts, accounts, categories, budgets] = await Promise.all([
    getDebts(user),
    getAccounts(user),
    getBudgetCategories(user),
    getBudgets(user),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display">IOUs</h1>
        <p className="text-muted-foreground mt-1 max-w-prose text-label">
          Money promised before it moves. It stays off every total until it&apos;s paid; crossing one off logs the
          money.
        </p>
      </header>

      <DebtsSection
        debts={debts}
        accounts={accounts}
        categories={categories}
        budgets={budgets}
        todayISO={toISODate(todayLocal(user.timezone))}
      />
    </div>
  );
}
