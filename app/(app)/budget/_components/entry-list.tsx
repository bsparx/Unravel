"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateWithWeekday, toISODate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { cn } from "@/lib/utils";

import { MoneyDialog, type MoneyDraft } from "./money-dialog";
import type { AccountOption, Budget, BudgetCategory, LedgerEntry } from "../_lib/queries";

type DialogDeps = {
  accounts: AccountOption[];
  categories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  budgets: Budget[];
};

function entryDraft(entry: LedgerEntry): MoneyDraft {
  return {
    id: entry.id,
    kind: entry.category.kind,
    amountCents: entry.amountCents,
    date: toISODate(entry.date),
    note: entry.note ?? "",
    accountId: entry.account?.id ?? null,
    categoryId: entry.category.id,
    budgetId: entry.budget?.id ?? null,
  };
}

/**
 * Rows of the ledger; a tap opens the entry to fix or delete. The dialog is
 * keyed by the draft, so its fields start from the entry without an effect
 * (the calendar's BlockDialog contract).
 */
export function EntryList({
  entries,
  showAccount,
  accounts,
  categories,
  budgets,
}: DialogDeps & {
  entries: LedgerEntry[];
  /** Name the account on each row: only worth it when there's more than one. */
  showAccount: boolean;
}) {
  const [draft, setDraft] = useState<MoneyDraft | null>(null);

  return (
    <>
      <ul className="divide-border divide-y">
        {entries.map((entry) => {
          const income = entry.category.kind === "INCOME";
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setDraft(entryDraft(entry))}
                className="hover:bg-accent/40 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset md:px-5"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[entry.category.color] ?? "var(--muted-foreground)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-label block truncate font-medium">{entry.note || entry.category.name}</span>
                  <span className="text-muted-foreground text-micro block truncate">
                    {formatDateWithWeekday(entry.date)}
                    {entry.note && ` · ${entry.category.name}`}
                    {showAccount && entry.account && ` · ${entry.account.name}`}
                    {entry.budget && (
                      <span className="border-border bg-accent ml-1.5 inline-block rounded-sm border px-1 text-[10px] leading-4">
                        {entry.budget.name}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-mono text-label shrink-0 tabular-nums",
                    income ? "text-money-in" : "text-money-out",
                  )}
                >
                  <span className="sr-only">{income ? "In" : "Out"} </span>
                  {income ? "+" : "−"}
                  {formatMoneyCompact(entry.amountCents)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {draft && (
        <MoneyDialog
          key={draft.id ?? "new"}
          draft={draft}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}

/** "Log money", with the dialog it opens. `kind` picks which side it starts on. */
export function LogMoneyButton({
  kind = "EXPENSE",
  label = "Log money",
  todayISO,
  accounts,
  categories,
  budgets,
  className,
}: DialogDeps & {
  kind?: "INCOME" | "EXPENSE";
  label?: string;
  todayISO: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<MoneyDraft | null>(null);

  return (
    <>
      <Button
        className={className}
        onClick={() =>
          setDraft({
            kind,
            amountCents: 0,
            date: todayISO,
            note: "",
            accountId: accounts.find((account) => !account.archived)?.id ?? null,
            categoryId: null,
            budgetId: null,
          })
        }
      >
        <Plus className="size-4" aria-hidden />
        {label}
      </Button>
      {draft && (
        <MoneyDialog
          key={`new-${draft.kind}`}
          draft={draft}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}
