"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDate, toISODate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

import { settleDebt } from "../actions";
import type { Account, Budget, BudgetCategory, Debt, DebtPocket } from "../_lib/queries";
import { DebtDialog, type DebtDraft } from "./debt-dialog";
import { MoneyDialog, type MoneyDraft } from "./money-dialog";

/**
 * The IOU ledger: two pockets, money promised before it moves.
 *
 * Owed to you is teal and you owe is clay — the same two semantic colours
 * the ledger spends, so a promise reads against a movement without being
 * one. Crossing an IOU off opens the money dialog: the sum lands in the
 * ledger as a real transaction, and only then does the IOU strike through.
 * Un-crossing is the one exception — it clears the strike-through but keeps
 * the transaction, because the money did move.
 */
export function DebtsSection({
  debts,
  accounts,
  categories,
  budgets,
  todayISO,
}: {
  debts: { iOwe: DebtPocket; owedToMe: DebtPocket };
  accounts: Account[];
  categories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  budgets: Budget[];
  todayISO: string;
}) {
  const [draft, setDraft] = useState<DebtDraft | null>(null);
  const [settleDraft, setSettleDraft] = useState<MoneyDraft | null>(null);

  /** Un-cross a settled IOU. The transaction it created stays in the ledger. */
  const uncross = async (debt: Debt) => {
    const formData = new FormData();
    formData.set("id", debt.id);
    await settleDebt(formData);
    toast.success("Back on the ledger.");
  };

  /** Open the settle dialog: log the money, cross the IOU off with it. */
  const settle = (debt: Debt) => {
    setSettleDraft({
      kind: debt.direction === "OWED_TO_ME" ? "INCOME" : "EXPENSE",
      amountCents: debt.amountCents,
      date: todayISO,
      note: debt.note
        ? `${debt.counterparty} — ${debt.note}`
        : debt.counterparty,
      accountId: accounts.find((account) => !account.archived)?.id ?? null,
      categoryId: null,
      budgetId: null,
      settleDebtId: debt.id,
    });
  };

  return (
    <section className="border-border bg-card mb-6 rounded-lg border">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-title">Who owes who</h2>
        <Button
          size="sm"
          onClick={() =>
            setDraft({
              direction: "I_OWE",
              counterparty: "",
              amountCents: 0,
              date: todayISO,
              note: "",
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </header>

      <div className="grid lg:grid-cols-2">
        <Pocket
          title="They owe you"
          tone="in"
          pocket={debts.owedToMe}
          empty="Nothing owed to you right now."
          onSettle={(debt) => (debt.settled ? uncross(debt) : settle(debt))}
          onEdit={(debt) =>
            setDraft({
              id: debt.id,
              direction: debt.direction,
              counterparty: debt.counterparty,
              amountCents: debt.amountCents,
              date: toISODate(debt.date),
              note: debt.note ?? "",
            })
          }
        />
        <Pocket
          title="You owe"
          tone="out"
          pocket={debts.iOwe}
          empty="Nothing you owe right now."
          onSettle={(debt) => (debt.settled ? uncross(debt) : settle(debt))}
          onEdit={(debt) =>
            setDraft({
              id: debt.id,
              direction: debt.direction,
              counterparty: debt.counterparty,
              amountCents: debt.amountCents,
              date: toISODate(debt.date),
              note: debt.note ?? "",
            })
          }
        />
      </div>

      {draft && (
        <DebtDialog
          key={draft.id ?? `new-${draft.direction}`}
          draft={draft}
          onClose={() => setDraft(null)}
        />
      )}

      {settleDraft && (
        <MoneyDialog
          key={`settle-${settleDraft.settleDebtId}`}
          draft={settleDraft}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
          onClose={() => setSettleDraft(null)}
        />
      )}
    </section>
  );
}

function Pocket({
  title,
  tone,
  pocket,
  empty,
  onSettle,
  onEdit,
}: {
  title: string;
  /** Which semantic colour the pocket wears: money in is teal, out is clay. */
  tone: "in" | "out";
  pocket: DebtPocket;
  empty: string;
  onSettle: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
}) {
  return (
    <div className="border-border border-b lg:border-b-0 lg:first:border-r">
      <div className="border-border flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h3 className="text-title">{title}</h3>
        <span
          className={cn(
            "font-mono text-title tabular-nums",
            tone === "in" ? "text-primary" : "text-destructive",
          )}
        >
          {formatMoneyCompact(pocket.totalCents)}
        </span>
      </div>

      {pocket.rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-center text-label">
          {empty}
        </p>
      ) : (
        <ul className="divide-y">
          {pocket.rows.map((debt) => (
            <li key={debt.id}>
              <div className="hover:bg-accent/40 flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onEdit(debt)}
                  className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "text-title block truncate",
                      debt.settled && "text-muted-foreground line-through",
                    )}
                  >
                    {debt.counterparty}
                  </span>
                  <span className="text-muted-foreground text-micro">
                    {formatDate(debt.date)}
                    {debt.note ? ` · ${debt.note}` : ""}
                  </span>
                </button>
                <span
                  className={cn(
                    "font-mono text-title shrink-0 tabular-nums",
                    debt.settled
                      ? "text-muted-foreground line-through"
                      : tone === "in"
                        ? "text-primary"
                        : "text-destructive",
                  )}
                >
                  {formatMoneyCompact(debt.amountCents)}
                </span>
                <button
                  type="button"
                  aria-label={
                    debt.settled
                      ? "Uncross — keep the transaction"
                      : "Settle — log the money"
                  }
                  title={debt.settled ? "Uncross" : "Settle"}
                  onClick={() => onSettle(debt)}
                  className={cn(
                    "focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    debt.settled
                      ? "border-border bg-accent text-muted-foreground"
                      : tone === "in"
                        ? "border-primary/40 text-primary hover:bg-primary/10"
                        : "border-destructive/40 text-destructive hover:bg-destructive/10",
                  )}
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
