"use client";

import { useEffect, useState } from "react";
import { Archive, Pencil } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
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

import { archiveAccount, getAccountDetailAction } from "../../actions";
import { AccountForm } from "./account-form";
import type { Account, AccountDetail } from "../../_lib/queries";

/**
 * The drill-in for one account: what moved in it over the shown month — the
 * ledger entries and the transfers — and the running balance they trace. The
 * body is keyed by account id so opening another account starts fresh.
 */
export function AccountSheet({
  account,
  monthISO,
  onClose,
}: {
  account: Account | null;
  /** YYYY-MM — the month the drill-in is scoped to. */
  monthISO: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(account)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md" side="right">
        {account && (
          <AccountSheetBody
            key={account.id}
            account={account}
            monthISO={monthISO}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RunningBalance({
  detail,
  color,
}: {
  detail: AccountDetail;
  color: string;
}) {
  const points = detail.runningBalance;
  if (points.length < 2) return null;

  const width = 320;
  const height = 64;
  const max = Math.max(...points.map((p) => p.cents), 0);
  const min = Math.min(...points.map((p) => p.cents), 0);
  const range = max - min || 1;
  const x = (day: number) => ((day - 1) / (points.length - 1)) * width;
  const y = (cents: number) => 6 + (1 - (cents - min) / range) * (height - 12);
  const line = points
    .map((p) => `${x(p.day).toFixed(1)},${y(p.cents).toFixed(1)}`)
    .join(" ");
  const baselineY = min < 0 && max > 0 ? y(0) : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full overflow-visible"
      role="img"
      aria-label="The account's running balance across the month"
    >
      {baselineY !== null && (
        <line
          x1="0"
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Stat({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone?: "in" | "out";
}) {
  return (
    <div>
      <p className="text-muted-foreground text-micro">{label}</p>
      <p
        className={cn(
          "font-mono text-label tabular-nums",
          tone === "in" && "text-primary",
          tone === "out" && "text-destructive",
          !tone && "text-foreground",
        )}
      >
        {formatMoneyCompact(cents)}
      </p>
    </div>
  );
}

function AccountSheetBody({
  account,
  monthISO,
  onClose,
}: {
  account: Account;
  monthISO: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void getAccountDetailAction(account.id, monthISO).then(setDetail);
  }, [account.id, monthISO]);

  const remove = async () => {
    const formData = new FormData();
    formData.set("id", account.id);
    await archiveAccount(formData);
    toast.success("Account archived — its entries stay on the ledger.");
    onClose();
  };

  type Movement =
    | {
        id: string;
        date: Date;
        text: string;
        sub: string;
        cents: number;
        kind: "INCOME" | "EXPENSE";
        color: string;
      }
    | {
        id: string;
        date: Date;
        text: string;
        sub: string;
        cents: number;
        kind: "TRANSFER_IN" | "TRANSFER_OUT";
        color: string;
      };

  const movements: Movement[] = detail
    ? [
        ...detail.entries.map((entry) => ({
          id: `e-${entry.id}`,
          date: entry.date,
          text: entry.note || entry.category.name,
          sub: entry.category.name,
          cents: entry.amountCents,
          kind: entry.category.kind as "INCOME" | "EXPENSE",
          color: CATEGORY_COLORS[entry.category.color],
        })),
        ...detail.transfers.map((transfer): Movement => {
          const outgoing = transfer.from.id === account.id;
          return {
            id: `t-${transfer.id}`,
            date: transfer.date,
            text: transfer.note || "Transfer",
            sub: outgoing ? `→ ${transfer.to.name}` : `← ${transfer.from.name}`,
            cents: transfer.amountCents,
            kind: outgoing ? "TRANSFER_OUT" : "TRANSFER_IN",
            color: CATEGORY_COLORS[transfer.to.color],
          };
        }),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  const netChange = detail
    ? detail.incomeCents -
      detail.expenseCents -
      detail.transferredOutCents +
      detail.transferredInCents
    : 0;

  const accountColor = CATEGORY_COLORS[account.color];

  return (
    <>
      <SheetHeader className="pr-10">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: accountColor }}
          />
          <SheetTitle className="font-display">{account.name}</SheetTitle>
        </div>
        <SheetDescription>
          {detail ? detail.monthLabel : "…"}
        </SheetDescription>
      </SheetHeader>

      {detail && (
        <div className="px-4">
          <div className="flex items-end justify-between gap-4">
            <p className="font-mono text-heading tabular-nums">
              {formatMoneyCompact(account.balanceCents)}
            </p>
            <p className="text-muted-foreground text-micro">
              {netChange >= 0 ? "+" : "−"}
              {formatMoneyCompact(Math.abs(netChange))} this month
            </p>
          </div>

          <div className="mt-2">
            <RunningBalance detail={detail} color={accountColor} />
          </div>

          <div className="grid grid-cols-4 gap-2 border-t pt-3">
            <Stat label="In" cents={detail.incomeCents} tone="in" />
            <Stat label="Out" cents={detail.expenseCents} tone="out" />
            <Stat label="Moved in" cents={detail.transferredInCents} />
            <Stat label="Moved out" cents={detail.transferredOutCents} />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto border-t">
        {detail && movements.length > 0 ? (
          <ul className="divide-y">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: movement.color || accountColor,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-title truncate">{movement.text}</p>
                  <p className="text-muted-foreground text-micro">
                    {formatDate(movement.date)} · {movement.sub}
                  </p>
                </div>
                <p
                  className={cn(
                    "font-mono text-label shrink-0 tabular-nums",
                    movement.kind === "INCOME" && "text-primary",
                    movement.kind === "EXPENSE" && "text-destructive",
                    movement.kind === "TRANSFER_IN" && "text-foreground",
                    movement.kind === "TRANSFER_OUT" && "text-muted-foreground",
                  )}
                >
                  {movement.kind === "EXPENSE" || movement.kind === "TRANSFER_OUT"
                    ? "−"
                    : movement.kind === "INCOME" || movement.kind === "TRANSFER_IN"
                      ? "+"
                      : ""}
                  {formatMoneyCompact(movement.cents)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground px-4 pt-6 pb-2 text-center text-label">
            Nothing moved in this account during {detail?.monthLabel ?? "this month"}.
            Money in, money out, or a transfer from another account all land here.
          </p>
        )}
      </div>

      {!editing && (
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
              title="Archive this account?"
              description="It leaves the picker — the money already in it stays on the ledger."
              confirmLabel="Archive it"
              onConfirm={remove}
              trigger={(open) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={open}
                  className="text-destructive"
                >
                  <Archive className="size-4" aria-hidden />
                  Archive
                </Button>
              )}
            />
          </div>
        </SheetFooter>
      )}

      {editing && (
        <>
          <SheetHeader className="pr-10">
            <SheetTitle className="font-display">Edit the account</SheetTitle>
            <SheetDescription>{account.name}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <AccountForm account={account} onSuccess={onClose} />
          </div>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Back
            </Button>
          </SheetFooter>
        </>
      )}
    </>
  );
}