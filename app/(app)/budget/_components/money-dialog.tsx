"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { deleteTransaction, logTransaction, updateTransaction } from "../actions";
import type { Budget, BudgetCategory } from "../_lib/queries";

export type MoneyDraft = {
  id?: string;
  kind: "INCOME" | "EXPENSE";
  amountCents: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  categoryId: string | null;
  /** The envelope this expense counts against, if any. */
  budgetId: string | null;
};

/** Cents -> the decimal string the form edits. "125050" -> "1250.50". */
function rupeesInput(amountCents: number): string {
  return amountCents % 100 === 0
    ? String(amountCents / 100)
    : (amountCents / 100).toFixed(2);
}

/**
 * Always mounted with a `key` derived from the draft — see the call site —
 * so the fields below are plain `useState` initialisers rather than an effect
 * copying props into state. Same contract as the calendar's BlockDialog.
 */
export function MoneyDialog({
  draft,
  categories,
  budgets,
  onClose,
}: {
  draft: MoneyDraft;
  /** Both sides, so the In/Out toggle can swap the options without a round trip. */
  categories: { income: BudgetCategory[]; expense: BudgetCategory[] };
  /** Every envelope, so the picker can offer the ones covering the date. */
  budgets: Budget[];
  onClose: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateTransaction : logTransaction,
    idleState,
  );

  const [kind, setKind] = useState<MoneyDraft["kind"]>(draft.kind);
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? "none");
  const [date, setDate] = useState(draft.date);
  const [budgetId, setBudgetId] = useState(draft.budgetId ?? "none");

  const options = kind === "INCOME" ? categories.income : categories.expense;

  // Only envelopes that actually cover the entry's date can hold it.
  const budgetOptions =
    kind === "EXPENSE"
      ? budgets.filter(
          (budget) =>
            budget.startsOn.toISOString().slice(0, 10) <= date &&
            budget.endsOn.toISOString().slice(0, 10) >= date,
        )
      : [];

  // Switching sides clears a selection that can't exist on the other side.
  const pickKind = (next: MoneyDraft["kind"]) => {
    setKind(next);
    const list = next === "INCOME" ? categories.income : categories.expense;
    if (!list.some((category) => category.id === categoryId)) {
      setCategoryId("none");
    }
    if (next === "INCOME") setBudgetId("none");
  };

  // A date that leaves every envelope behind drops the assignment.
  const pickDate = (next: string) => {
    setDate(next);
    if (
      budgetId !== "none" &&
      !budgets.some(
        (budget) =>
          budget.id === budgetId &&
          budget.startsOn.toISOString().slice(0, 10) <= next &&
          budget.endsOn.toISOString().slice(0, 10) >= next,
      )
    ) {
      setBudgetId("none");
    }
  };

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      onClose();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit this entry" : "Log money"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Fix it, or let it go."
              : "Money in or money out, in under a tap — the thinking can happen later."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {draft.id && <input type="hidden" name="id" value={draft.id} />}
          <input type="hidden" name="kind" value={kind} />
          <input
            type="hidden"
            name="budgetId"
            value={budgetId === "none" ? "" : budgetId}
          />

          <div className="grid grid-cols-2 gap-1.5">
            {(["INCOME", "EXPENSE"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => pickKind(option)}
                aria-pressed={kind === option}
                className={cn(
                  "focus-visible:ring-ring rounded-md border px-2 py-1.5 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  kind === option
                    ? option === "INCOME"
                      ? "border-primary bg-accent"
                      : "border-destructive/50 bg-destructive/10"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {option === "INCOME" ? "In" : "Out"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="money-amount">Amount</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
                Rs
              </span>
              <Input
                id="money-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                maxLength={12}
                defaultValue={rupeesInput(draft.amountCents)}
                placeholder="1250.50"
                className="pl-10 font-mono tabular-nums"
              />
            </div>
            {error("amount") && (
              <p role="alert" className="text-destructive text-label">
                {error("amount")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="money-category">Category</Label>
            <Select name="categoryId" value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="money-category">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pick a category</SelectItem>
                {options.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error("categoryId") && (
              <p role="alert" className="text-destructive text-label">
                {error("categoryId")}
              </p>
            )}
          </div>

          {kind === "EXPENSE" && (
            <div className="space-y-1.5">
              <Label htmlFor="money-budget">Budget</Label>
              <Select
                name="budgetId"
                value={budgetId}
                onValueChange={setBudgetId}
              >
                <SelectTrigger id="money-budget">
                  <SelectValue placeholder="No budget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No budget</SelectItem>
                  {budgetOptions.map((budget) => (
                    <SelectItem key={budget.id} value={budget.id}>
                      {budget.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error("budgetId") && (
                <p role="alert" className="text-destructive text-label">
                  {error("budgetId")}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="money-date">When</Label>
              <Input
                id="money-date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => pickDate(event.target.value)}
              />
              {error("date") && (
                <p role="alert" className="text-destructive text-label">
                  {error("date")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="money-note">Note</Label>
              <Input
                id="money-note"
                name="note"
                maxLength={200}
                defaultValue={draft.note}
                placeholder="Optional."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft.id ? (
              <ConfirmDialog
                title="Delete this entry?"
                description="It leaves the ledger for good — the month's totals change with it."
                confirmLabel="Delete it"
                onConfirm={async () => {
                  const formData = new FormData();
                  formData.set("id", draft.id!);
                  await deleteTransaction(formData);
                  toast.success("Gone.");
                  onClose();
                }}
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
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save" : "Log it"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
