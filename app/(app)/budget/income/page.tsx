import { LedgerPage } from "../_components/ledger-page";

export const metadata = { title: "Income" };

export default async function BudgetIncomePage({ searchParams }: PageProps<"/budget/income">) {
  // Next 16: searchParams is a Promise.
  return <LedgerPage kind="INCOME" params={await searchParams} />;
}
