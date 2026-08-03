"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { formatDate } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

import {
  deleteBudget,
  getBudgetDetailAction,
  removeTransactionFromBudget,
} from "../actions";
import { BudgetForm } from "./budget-form";
import type { Budget, BudgetDetail } from "../_lib/queries";

function periodLabel(budget: Budget): string {
  const startDay = budget.startsOn.getUTCDate();
  const sameMonth =
    budget.startsOn.getUTCMonth() === budget.endsOn.getUTCMonth() &&
    budget.startsOn.getUTCFullYear() === budget.endsOn.getUTCFullYear();
  return sameMonth
    ? `${startDay} – ${formatDate(budget.endsOn)}`
    : `${formatDate(budget.startsOn)} – ${formatDate(budget.endsOn)}`;
}

/**
 * The drill-in for one envelope: where it stands, what's in it, and the few
 * things you can do — edit the target, take an expense out of it (never
 * delete it), delete the envelope itself (which only unassigns its expenses),
 * or add another expense straight into it.
 *
 * The body is keyed by the budget id so opening a different envelope starts
 * from scratch without an effect resetting state.
 */
export function BudgetDetailSheet({
  budget,
  onClose,
  onAddExpense,
}: {
  budget: Budget | null;
  onClose: () => void;
  onAddExpense: (budget: Budget) => void;
}) {
  return (
    <Sheet open={Boolean(budget)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md" side="right">
        {budget && (
          <BudgetSheetBody
            key={budget.id}
            budget={budget}
            onClose={onClose}
            onAddExpense={onAddExpense}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function BudgetSheetBody({
  budget,
  onClose,
  onAddExpense,
}: {
  budget: Budget;
  onClose: () => void;
  onAddExpense: (budget: Budget) => void;
}) {
  const [detail, setDetail] = useState<BudgetDetail | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void getBudgetDetailAction(budget.id).then(setDetail);
  }, [budget.id]);

  const remove = async (transactionId: string) => {
    const formData = new FormData();
    formData.set("id", transactionId);
    await removeTransactionFromBudget(formData);
    toast.success("Removed from the budget.");
    void getBudgetDetailAction(budget.id).then(setDetail);
  };

  const removeBudget = async () => {
    if (!budget) return;
    const formData = new FormData();
    formData.set("id", budget.id);
    await deleteBudget(formData);
    toast.success("Budget deleted — its expenses are still on the ledger.");
    onClose();
  };

  const over = detail
    ? detail.budget.remainingCents < 0
    : budget
      ? budget.remainingCents < 0
      : false;
  const spent = detail?.budget.spentCents ?? budget?.spentCents ?? 0;
  const amount = detail?.budget.amountCents ?? budget?.amountCents ?? 0;
  const remaining = detail?.budget.remainingCents ?? budget?.remainingCents ?? 0;
  const percent = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0;

  return (
    <Sheet open={Boolean(budget)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md" side="right">
        {budget && !editing && (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle className="font-display">{budget.name}</SheetTitle>
              <SheetDescription>{periodLabel(budget)}</SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-2">
              <div className="flex items-end justify-between gap-4">
                <p
                  className={cn(
                    "font-mono text-heading tabular-nums",
                    over ? "text-destructive" : "text-foreground",
                  )}
                >
                  {over
                    ? `Over by ${formatMoneyCompact(Math.abs(remaining))}`
                    : formatMoneyCompact(remaining)}
                </p>
                <p className="text-muted-foreground text-micro">
                  of {formatMoneyCompact(amount)}
                </p>
              </div>
              <Progress
                value={percent}
                className={cn("mt-2", over && "[&>div]:bg-destructive")}
                aria-label={`${percent}% of the budget spent`}
              />
              <p className="text-muted-foreground mt-2 text-label">
                {spent === 0
                  ? "Nothing assigned yet — add an expense to start the countdown."
                  : `${formatMoneyCompact(spent)} in ${detail?.entries.length ?? 0} expense${(detail?.entries.length ?? 0) === 1 ? "" : "s"} · ${percent}% spent.`}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {detail && detail.entries.length > 0 && (
                <ul className="divide-y">
                  {detail.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CATEGORY_COLORS[entry.category.color] ??
                            "var(--muted-foreground)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-title truncate">
                          {entry.category.name}
                          {entry.note && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              · {entry.note}
                            </span>
                          )}
                        </p>
                        <p className="text-muted-foreground text-micro">
                          {formatDate(entry.date)}
                        </p>
                      </div>
                      <p className="font-mono text-label shrink-0 tabular-nums">
                        {formatMoneyCompact(entry.amountCents)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void remove(entry.id)}
                        aria-label={`Remove ${entry.category.name} from the budget`}
                        title="Remove from the budget — the expense itself stays on the ledger"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SheetFooter className="flex-row items-center justify-between gap-2">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Button>
                <ConfirmDialog
                  title="Delete this budget?"
                  description="Its expenses stay on the ledger — they just stop counting against a target."
                  confirmLabel="Delete it"
                  onConfirm={removeBudget}
                  trigger={(open) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={open}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </Button>
                  )}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => onAddExpense(budget)}
              >
                <Plus className="size-4" aria-hidden />
                Add expense
              </Button>
            </SheetFooter>
          </>
        )}

        {budget && editing && (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle className="font-display">Edit the budget</SheetTitle>
              <SheetDescription>
                Shrinking the dates unassigns the expenses that fall outside
                them — the ledger itself is untouched.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <BudgetForm budget={budget} onSuccess={onClose} />
            </div>
            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Back
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
