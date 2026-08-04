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
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { deleteDebt, logDebt, updateDebt } from "../actions";

export type DebtDraft = {
  id?: string;
  direction: "I_OWE" | "OWED_TO_ME";
  /** The person on the other side of the money. */
  counterparty: string;
  amountCents: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
};

/** Cents -> the decimal string the form edits. "125050" -> "1250.50". */
function rupeesInput(amountCents: number): string {
  return amountCents % 100 === 0
    ? String(amountCents / 100)
    : (amountCents / 100).toFixed(2);
}

/**
 * Add or edit an IOU. Same contract as MoneyDialog: keyed by the draft at
 * the call site, plain `useState` initialisers, no effect copying props.
 */
export function DebtDialog({
  draft,
  onClose,
}: {
  draft: DebtDraft;
  onClose: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateDebt : logDebt,
    idleState,
  );

  const [direction, setDirection] = useState<DebtDraft["direction"]>(draft.direction);
  const [counterparty, setCounterparty] = useState(draft.counterparty);
  const [amountText, setAmountText] = useState(() => rupeesInput(draft.amountCents));
  const [date, setDate] = useState(draft.date);
  const [note, setNote] = useState(draft.note);

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
            {editing ? "Edit this IOU" : "Who owes who"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Fix it, or let it go."
              : "Money promised, before it moves — a name, an amount, a date."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {draft.id && <input type="hidden" name="id" value={draft.id} />}
          <input type="hidden" name="direction" value={direction} />

          <div className="grid grid-cols-2 gap-1.5">
            {(["OWED_TO_ME", "I_OWE"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDirection(option)}
                aria-pressed={direction === option}
                className={cn(
                  "focus-visible:ring-ring rounded-md border px-2 py-1.5 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  direction === option
                    ? option === "OWED_TO_ME"
                      ? "border-primary bg-accent"
                      : "border-destructive/50 bg-destructive/10"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {option === "OWED_TO_ME" ? "They owe me" : "I owe them"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-who">Who</Label>
            <Input
              id="debt-who"
              name="counterparty"
              autoComplete="off"
              autoFocus
              maxLength={80}
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              placeholder="Ali, the landlord, Mum…"
            />
            {error("counterparty") && (
              <p role="alert" className="text-destructive text-label">
                {error("counterparty")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="debt-amount">Amount</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
                Rs
              </span>
              <Input
                id="debt-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                maxLength={12}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="debt-date">When</Label>
              <Input
                id="debt-date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              {error("date") && (
                <p role="alert" className="text-destructive text-label">
                  {error("date")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-note">What for</Label>
              <Input
                id="debt-note"
                name="note"
                maxLength={200}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft.id ? (
              <ConfirmDialog
                title="Delete this IOU?"
                description="It leaves the ledger for good — no trace in either pocket."
                confirmLabel="Delete it"
                onConfirm={async () => {
                  const formData = new FormData();
                  formData.set("id", draft.id!);
                  await deleteDebt(formData);
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
                {pending ? "Saving…" : editing ? "Save" : "Noted"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
