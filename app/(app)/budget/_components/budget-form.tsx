"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toISODate } from "@/lib/dates";
import { idleState } from "@/lib/validation";

import { createBudget, updateBudget } from "../actions";
import type { Budget } from "../_lib/queries";

/** A local day, plus a default week's headroom, for a fresh budget. */
function defaultRange(): { startsOn: string; endsOn: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 6);
  return { startsOn: toISODate(start), endsOn: toISODate(end) };
}

/**
 * The fields every budget needs — shared by the "New budget" dialog and the
 * edit view inside the detail sheet, keyed by `budget` so an edit opens on
 * that budget's values. Dates are plain local days (YYYY-MM-DD); the server
 * resolves them into the user's calendar.
 */
export function BudgetForm({
  budget,
  onSuccess,
}: {
  budget?: Budget;
  onSuccess: () => void;
}) {
  const editing = Boolean(budget);
  const [state, formAction, pending] = useActionState(
    editing ? updateBudget : createBudget,
    idleState,
  );

  const range = budget
    ? {
        startsOn: toISODate(budget.startsOn),
        endsOn: toISODate(budget.endsOn),
      }
    : defaultRange();
  const [startsOn, setStartsOn] = useState(range.startsOn);
  const [endsOn, setEndsOn] = useState(range.endsOn);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      onSuccess();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
    // onSuccess is a fresh closure each render; depending on it would re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {budget?.id && <input type="hidden" name="id" value={budget.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="budget-name">Name</Label>
        <Input
          id="budget-name"
          name="name"
          maxLength={40}
          defaultValue={budget?.name}
          placeholder="Trip to Lahore, August rent, eating out…"
          autoFocus
        />
        {error("name") && (
          <p role="alert" className="text-destructive text-label">
            {error("name")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-amount">How much</Label>
        <div className="relative">
          <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
            Rs
          </span>
          <Input
            id="budget-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            defaultValue={budget ? String(budget.amountCents / 100) : ""}
            placeholder="25000"
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
          <Label htmlFor="budget-start">Starts</Label>
          <Input
            id="budget-start"
            name="startsOn"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
          {error("startsOn") && (
            <p role="alert" className="text-destructive text-label">
              {error("startsOn")}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget-end">Ends</Label>
          <Input
            id="budget-end"
            name="endsOn"
            type="date"
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
          {error("endsOn") && (
            <p role="alert" className="text-destructive text-label">
              {error("endsOn")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create budget"}
        </Button>
      </div>
    </form>
  );
}
