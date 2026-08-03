"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate, toISODate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { cn } from "@/lib/utils";

import { MoneyDialog, type MoneyDraft } from "./money-dialog";
import type { Account, Budget, BudgetMonth, BudgetCategory } from "../_lib/queries";

type Entry = BudgetMonth["entries"][number];

function entryDraft(entry: Entry): MoneyDraft {
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
 * The ledger, and the only place on the page money is added or fixed.
 *
 * The dialog is owned here rather than by the page: it needs client state to
 * open, and keying it by the draft being edited gives the form its initial
 * values without an effect (the calendar's BlockDialog contract).
 */
export function TransactionsSection({
  entries,
  accounts,
  categories,
  budgets,
  monthLabel,
  todayISO,
}: {
  entries: BudgetMonth["entries"];
  accounts: Account[];
  categories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  budgets: Budget[];
  monthLabel: string;
  todayISO: string;
}) {
  const [draft, setDraft] = useState<MoneyDraft | null>(null);

  return (
    <section className="border-border bg-card rounded-lg border">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-title">
          Transactions
          {entries.length > 0 && (
            <span className="text-muted-foreground"> · {entries.length}</span>
          )}
        </h2>
        <Button
          size="sm"
          onClick={() =>
            setDraft({
              kind: "EXPENSE",
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
          Log money
        </Button>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground px-4 py-8 text-center text-label">
          Nothing logged in {monthLabel} yet. Money in or out lands here.
        </p>
      ) : (
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setDraft(entryDraft(entry))}
                className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[entry.category.color] ??
                      "var(--muted-foreground)",
                  }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="text-title block truncate">
                    {entry.note || entry.category.name}
                  </span>
                  <span className="text-muted-foreground text-micro">
                    {formatDate(entry.date)} · {entry.category.name}
                    {entry.budget && (
                      <span className="border-border bg-accent text-muted-foreground ml-1.5 inline-block rounded-sm border px-1 text-[10px] leading-4">
                        {entry.budget.name}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-mono text-title shrink-0 tabular-nums",
                    entry.category.kind === "INCOME"
                      ? "text-primary"
                      : "text-destructive",
                  )}
                >
                  {entry.category.kind === "INCOME" ? "+" : "−"}
                  {formatMoneyCompact(entry.amountCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <MoneyDialog
          key={draft.id ?? `new-${draft.date}`}
          draft={draft}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  );
}
