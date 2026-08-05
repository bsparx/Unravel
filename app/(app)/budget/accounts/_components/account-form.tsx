"use client";

import { useEffect, useActionState, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS, type CategoryColor } from "@/lib/money-palette";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createAccount, updateAccount } from "../../actions";
import type { Account } from "../../_lib/queries";

/** The four colours an account may wear, in picker order. */
const COLORS = ["teal", "sage", "sand", "ink"] as const;

function openingInput(account: Account | null): string {
  if (!account || account.openingCents === 0) return "";
  return account.openingCents % 100 === 0
    ? String(account.openingCents / 100)
    : (account.openingCents / 100).toFixed(2);
}

/**
 * Add or edit an account. One form for both — the edit path just carries an
 * id, letting a non-destructive save rename/re-colour an account that holds
 * history without touching the history.
 */
export function AccountForm({
  account,
  onSuccess,
}: {
  account?: Account | null;
  onSuccess: () => void;
}) {
  const editing = Boolean(account?.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateAccount : createAccount,
    idleState,
  );

  const [name, setName] = useState(account?.name ?? "");
  const [color, setColor] = useState<CategoryColor>(
    account?.color ?? "teal",
  );
  const [openingAmount, setOpeningAmount] = useState(openingInput(account ?? null));

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={formAction} className="space-y-4">
      {account?.id && <input type="hidden" name="id" value={account.id} />}
      <input type="hidden" name="color" value={color} />

      <div className="space-y-1.5">
        <Label htmlFor="account-name">Account name</Label>
        <Input
          id="account-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoFocus
          placeholder="e.g. Family"
        />
        {error("name") && (
          <p role="alert" className="text-destructive text-label">
            {error("name")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Colour</Label>
        <div className="flex gap-2">
          {COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              aria-pressed={color === option}
              aria-label={`${option} colour`}
              className={cn(
                "focus-visible:ring-ring size-6 rounded-full transition-transform focus-visible:ring-2 focus-visible:outline-none",
                color === option && "scale-110",
              )}
              style={{ backgroundColor: CATEGORY_COLORS[option] }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account-opening">Already in it (optional)</Label>
        <div className="relative">
          <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-label">
            Rs
          </span>
          <Input
            id="account-opening"
            name="openingAmount"
            inputMode="decimal"
            autoComplete="off"
            maxLength={12}
            value={openingAmount}
            onChange={(event) => setOpeningAmount(event.target.value)}
            placeholder="0"
            className="pl-10 font-mono tabular-nums"
          />
        </div>
        <p className="text-muted-foreground text-micro">
          Money already here when you started logging — the balance counts
          it before anything lands.
        </p>
        {error("openingAmount") && (
          <p role="alert" className="text-destructive text-label">
            {error("openingAmount")}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending || name.trim() === ""}>
        {pending ? "Saving…" : editing ? "Save account" : "Add account"}
      </Button>
    </form>
  );
}