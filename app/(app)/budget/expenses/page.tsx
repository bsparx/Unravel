import { LedgerPage } from "../_components/ledger-page";

export const metadata = { title: "Expenses" };

export default async function BudgetExpensesPage({ searchParams }: PageProps<"/budget/expenses">) {
  // Next 16: searchParams is a Promise.
  return <LedgerPage kind="EXPENSE" params={await searchParams} />;
}
