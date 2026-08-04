"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

import { BudgetDetailSheet } from "./budget-detail-sheet";
import { BudgetForm } from "./budget-form";
import { MoneyDialog, type MoneyDraft } from "./money-dialog";
import type { Account, Budget, BudgetCategory } from "../_lib/queries";

function isInRange(budget: Budget, dayISO: string): boolean {
  return (
    budget.startsOn.toISOString().slice(0, 10) <= dayISO &&
    budget.endsOn.toISOString().slice(0, 10) >= dayISO
  );
}

function periodLabel(budget: Budget): string {
  const startDay = budget.startsOn.getUTCDate();
  const sameMonth =
    budget.startsOn.getUTCMonth() === budget.endsOn.getUTCMonth() &&
    budget.startsOn.getUTCFullYear() === budget.endsOn.getUTCFullYear();
  return sameMonth
    ? `${startDay} – ${formatDate(budget.endsOn)}`
    : `${formatDate(budget.startsOn)} – ${formatDate(budget.endsOn)}`;
}

/** How much of the envelope has gone, as a percentage — 0% means it's all left. */
function spentPercent(budget: Budget): number {
  return budget.amountCents > 0
    ? Math.round((budget.spentCents / budget.amountCents) * 100)
    : 0;
}

/**
 * A budget that is running right now: today falls inside its dates, so it
 * gets the full treatment — countdown, the fill bar, and the spent-out-of
 * line. Every running budget is a card; nothing gets demoted for being
 * second.
 */
function RunningCard({
  budget,
  onOpen,
}: {
  budget: Budget;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-accent/40 focus-visible:ring-ring block w-full cursor-pointer px-5 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-title truncate">{budget.name}</p>
          <p className="text-muted-foreground text-micro">
            {periodLabel(budget)} · running now
          </p>
        </div>
        <p
          className={cn(
            "font-mono text-heading tabular-nums",
            budget.remainingCents < 0
              ? "text-destructive"
              : "text-foreground",
          )}
        >
          {budget.remainingCents < 0
            ? `Over by ${formatMoneyCompact(Math.abs(budget.remainingCents))}`
            : formatMoneyCompact(budget.remainingCents)}
        </p>
      </div>
      <Progress
        value={
          budget.amountCents > 0
            ? Math.min(
                100,
                Math.round((budget.spentCents / budget.amountCents) * 100),
              )
            : 0
        }
        className={cn(
          "mt-3",
          budget.remainingCents < 0 && "[&>div]:bg-destructive",
        )}
        aria-label={`${budget.spentCents} of ${budget.amountCents} spent`}
      />
      <p className="text-muted-foreground mt-2 text-micro">
        {formatMoneyCompact(budget.spentCents)} of{" "}
        {formatMoneyCompact(budget.amountCents)} spent
        <span
          className={cn(
            budget.remainingCents < 0 && "text-destructive",
          )}
        >
          {" "}
          · {spentPercent(budget)}%
        </span>
      </p>
    </button>
  );
}

/**
 * The envelopes. Every envelope whose dates cover today is a running card —
 * how much is left, how fast it is going — and every other envelope is a row
 * beneath them. One tap opens the drill-in.
 */
export function BudgetsSection({
  budgets,
  accounts,
  categories,
  todayISO,
}: {
  budgets: Budget[];
  accounts: Account[];
  categories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  /** Today, YYYY-MM-DD, so "running right now" is decided where it can't lie. */
  todayISO: string;
}) {
  const [openBudget, setOpenBudget] = useState<Budget | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<MoneyDraft | null>(null);

  const running = budgets.filter((budget) => isInRange(budget, todayISO));
  const others = budgets.filter((budget) => !isInRange(budget, todayISO));

  const openExpenseFor = (budget: Budget) => {
    setOpenBudget(null);
    setExpenseDraft({
      kind: "EXPENSE",
      amountCents: 0,
      date: isInRange(budget, todayISO)
        ? todayISO
        : budget.startsOn.toISOString().slice(0, 10),
      note: "",
      accountId: accounts.find((account) => !account.archived)?.id ?? null,
      categoryId: null,
      budgetId: budget.id,
    });
  };

  return (
    <section className="border-border bg-card mb-6 rounded-lg border">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-title">Budgets</h2>
          <p className="text-muted-foreground text-micro">
            {budgets.length === 0
              ? "A target for a stretch — expenses assigned to it count down."
              : running.length > 0
                ? `${running.length} running now`
                : "Nothing running right now."}
          </p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New budget
        </Button>
      </header>

      {running.length > 0 && (
        <div className="divide-y border-t">
          {running.map((budget) => (
            <RunningCard
              key={budget.id}
              budget={budget}
              onOpen={() => setOpenBudget(budget)}
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="divide-y border-t">
          {others.map((budget) => (
            <li key={budget.id}>
              <button
                type="button"
                onClick={() => setOpenBudget(budget)}
                className="hover:bg-accent/40 focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-title truncate">{budget.name}</p>
                  <p className="text-muted-foreground text-micro">
                    {periodLabel(budget)}
                  </p>
                  <Progress
                    value={
                      budget.amountCents > 0
                        ? Math.min(
                            100,
                            Math.round((budget.spentCents / budget.amountCents) * 100),
                          )
                        : 0
                    }
                    className={cn(
                      "mt-2",
                      budget.remainingCents < 0 && "[&>div]:bg-destructive",
                    )}
                    aria-label={`${budget.spentCents} of ${budget.amountCents} spent`}
                  />
                  <p className="text-muted-foreground mt-1.5 text-micro">
                    {formatMoneyCompact(budget.spentCents)} of{" "}
                    {formatMoneyCompact(budget.amountCents)} spent
                    <span
                      className={cn(
                        budget.remainingCents < 0 && "text-destructive",
                      )}
                    >
                      {" "}
                      · {spentPercent(budget)}%
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "font-mono text-label tabular-nums",
                      budget.remainingCents < 0
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {budget.remainingCents < 0
                      ? `Over by ${formatMoneyCompact(Math.abs(budget.remainingCents))}`
                      : formatMoneyCompact(budget.remainingCents)}
                  </p>
                </div>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {budgets.length === 0 && (
        <p className="text-muted-foreground border-t px-5 py-4 text-label">
          No budgets yet. Set one for a trip, a project, or a stretch of the
          month — expenses assigned to it count down.
        </p>
      )}

      <BudgetDetailSheet
        budget={openBudget}
        onClose={() => setOpenBudget(null)}
        onAddExpense={openExpenseFor}
      />

      <Dialog open={newOpen} onOpenChange={(open) => !open && setNewOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New budget</DialogTitle>
            <DialogDescription>
              A name, an amount, and the days it covers. Expenses you assign to
              it count down from the amount.
            </DialogDescription>
          </DialogHeader>
          <BudgetForm onSuccess={() => setNewOpen(false)} />
        </DialogContent>
      </Dialog>

      {expenseDraft && (
        <MoneyDialog
          key={`expense-${expenseDraft.budgetId ?? "none"}`}
          draft={expenseDraft}
          accounts={accounts}
          categories={categories}
          budgets={budgets}
          onClose={() => setExpenseDraft(null)}
        />
      )}
    </section>
  );
}
