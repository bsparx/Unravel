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
import {
  describeCycle,
  MAX_REMIND_DAYS,
  SUBSCRIPTION_CYCLES,
  type SubscriptionCycle,
} from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { idleState } from "@/lib/validation";

import {
  createSubscription,
  deleteSubscription,
  toggleSubscriptionCancelled,
  updateSubscription,
} from "../actions";

export type SubscriptionDraft = {
  id?: string;
  name: string;
  amountCents: number;
  cycle: SubscriptionCycle;
  /** YYYY-MM-DD shown in the form: the next renewal. */
  nextISO: string;
  /**
   * YYYY-MM-DD actually stored. Sent back unchanged when neither the date nor
   * the cycle is touched, so a 31st-of-the-month anchor doesn't collapse onto a clamped
   * 28 Feb just because the form was saved in February.
   */
  anchorISO: string;
  accountEmail: string;
  remindDaysBefore: number;
  note: string;
  cancelled: boolean;
};

/** Cents -> the decimal string the form edits. "125050" -> "1250.50". */
function rupeesInput(amountCents: number): string {
  if (amountCents === 0) return "";
  return amountCents % 100 === 0
    ? String(amountCents / 100)
    : (amountCents / 100).toFixed(2);
}

/**
 * Add or edit a subscription. Same contract as the budget dialogs: keyed by
 * the draft at the call site, plain `useState` initialisers, no effect
 * copying props.
 */
export function SubscriptionDialog({
  draft,
  onClose,
}: {
  draft: SubscriptionDraft;
  onClose: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateSubscription : createSubscription,
    idleState,
  );

  const [name, setName] = useState(draft.name);
  const [amountText, setAmountText] = useState(() =>
    rupeesInput(draft.amountCents),
  );
  const [cycle, setCycle] = useState<SubscriptionCycle>(draft.cycle);
  const [date, setDate] = useState(draft.nextISO);
  const [email, setEmail] = useState(draft.accountEmail);
  const [remind, setRemind] = useState(String(draft.remindDaysBefore));
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

  const withId = async (action: (formData: FormData) => Promise<void>) => {
    const formData = new FormData();
    formData.set("id", draft.id!);
    await action(formData);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? `Edit ${draft.name}` : "New subscription"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the price, date or account when they change."
              : "What it is, what it costs, and when it next renews."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {draft.id && <input type="hidden" name="id" value={draft.id} />}
          <input type="hidden" name="cycle" value={cycle} />
          <input
            type="hidden"
            name="renewsOn"
            value={
              date === draft.nextISO && cycle === draft.cycle
                ? draft.anchorISO
                : date
            }
          />

          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Name</Label>
            <Input
              id="sub-name"
              name="name"
              autoComplete="off"
              autoFocus={!editing}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Netflix, iCloud, gym…"
            />
            {error("name") && (
              <p role="alert" className="text-destructive text-label">
                {error("name")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-amount">Renewal price</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
                Rs
              </span>
              <Input
                id="sub-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                maxLength={12}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                placeholder="1100"
                className="pl-10 font-mono tabular-nums"
              />
            </div>
            {error("amount") && (
              <p role="alert" className="text-destructive text-label">
                {error("amount")}
              </p>
            )}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-label font-medium">Billed</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {SUBSCRIPTION_CYCLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCycle(option)}
                  aria-pressed={cycle === option}
                  className={cn(
                    "focus-visible:ring-ring rounded-md border px-2 py-1.5 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
                    cycle === option
                      ? "border-primary bg-accent"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {describeCycle(option)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-date">Next renewal</Label>
              <Input
                id="sub-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              {error("renewsOn") && (
                <p role="alert" className="text-destructive text-label">
                  {error("renewsOn")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-remind">Remind me</Label>
              <div className="relative">
                <Input
                  id="sub-remind"
                  name="remindDaysBefore"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_REMIND_DAYS}
                  value={remind}
                  onChange={(event) => setRemind(event.target.value)}
                  className="pr-24 font-mono tabular-nums"
                />
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-label">
                  days before
                </span>
              </div>
              {error("remindDaysBefore") && (
                <p role="alert" className="text-destructive text-label">
                  {error("remindDaysBefore")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-email">Account email</Label>
            <Input
              id="sub-email"
              name="accountEmail"
              type="email"
              autoComplete="off"
              maxLength={120}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Which account it's billed to"
            />
            {error("accountEmail") && (
              <p role="alert" className="text-destructive text-label">
                {error("accountEmail")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-note">Note</Label>
            <Input
              id="sub-note"
              name="note"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional. Family plan, card ending 4412…"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft.id ? (
              <div className="flex gap-1">
                <ConfirmDialog
                  title={`Delete ${draft.name}?`}
                  description="It's removed completely. To stop tracking it but keep the record, mark it cancelled instead."
                  confirmLabel="Delete it"
                  onConfirm={async () => {
                    await withId(deleteSubscription);
                    toast.success("Deleted.");
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await withId(toggleSubscriptionCancelled);
                    toast.success(
                      draft.cancelled ? "Reactivated." : "Marked cancelled.",
                    );
                    onClose();
                  }}
                >
                  {draft.cancelled ? "Reactivate" : "Mark cancelled"}
                </Button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
