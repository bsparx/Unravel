"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

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

import { logTransfer } from "../../actions";
import type { Account } from "../../_lib/queries";

/**
 * Move money between two accounts. The row it was opened from is "from"; the
 * rest of the list is "to". One row, two balance changes — and nothing on the
 * month's in/out, because moving your own money isn't earning or spending it.
 */
export function TransferDialog({
  accounts,
  defaultFrom,
  todayISO,
  onClose,
}: {
  accounts: Account[];
  /** The account the dialog was opened from. */
  defaultFrom: string;
  todayISO: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(logTransfer, idleState);

  const [fromId, setFromId] = useState(defaultFrom);
  const [toId, setToId] = useState(
    accounts.find((account) => account.id !== defaultFrom)?.id ?? defaultFrom,
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState("");

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
  };

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Moved.");
      onClose();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Move money</DialogTitle>
          <DialogDescription>
            From one of your accounts to another. It isn&apos;t income and it
            isn&apos;t spending — the month&apos;s totals don&apos;t change.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="fromAccountId" value={fromId} />
          <input type="hidden" name="toAccountId" value={toId} />

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-from">From</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger id="transfer-from">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={swap}
              aria-label="Swap the two accounts"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-1 rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ArrowLeftRight className="size-4" aria-hidden />
            </button>

            <div className="space-y-1.5">
              <Label htmlFor="transfer-to">To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger id="transfer-to">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error("toAccountId") && (
            <p role="alert" className="text-destructive -mt-2 text-label">
              {error("toAccountId")}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount">Amount</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
                Rs
              </span>
              <Input
                id="transfer-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                maxLength={12}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
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
              <Label htmlFor="transfer-date">When</Label>
              <Input
                id="transfer-date"
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
              <Label htmlFor="transfer-note">Note</Label>
              <Input
                id="transfer-note"
                name="note"
                maxLength={200}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}