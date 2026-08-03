"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORY_COLORS } from "@/lib/money-palette";
import { formatMoneyCompact } from "@/lib/money";

import { AccountSheet } from "./account-sheet";
import { AccountForm } from "./account-form";
import { TransferDialog } from "./transfer-dialog";
import type { Account } from "../../_lib/queries";

function BalanceBar({ accounts }: { accounts: Account[] }) {
  const nonArchived = accounts.filter((account) => !account.archived);
  const total = nonArchived.reduce((sum, account) => sum + account.balanceCents, 0);

  if (nonArchived.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        className="flex h-3 w-full gap-px overflow-hidden rounded-full"
        role="img"
        aria-label="Where your money sits, by share of the total"
      >
        {nonArchived.map((account) => {
          const share = total > 0 ? account.balanceCents / total : 0;
          if (share <= 0) return null;
          const color = CATEGORY_COLORS[account.color] ?? "var(--muted-foreground)";
          return (
            <div
              key={account.id}
              title={`${account.name} — ${formatMoneyCompact(account.balanceCents)}`}
              className="h-3"
              style={{ width: `${share * 100}%`, backgroundColor: color }}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {nonArchived.map((account) => (
          <li
            key={account.id}
            className="text-muted-foreground flex items-center gap-1.5 text-micro"
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[account.color] }}
            />
            {account.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AccountManager({
  accounts,
  todayISO,
  monthISO,
}: {
  accounts: Account[];
  todayISO: string;
  /** YYYY-MM — the month an account's drill-in is scoped to. */
  monthISO: string;
}) {
  const [opened, setOpened] = useState<Account | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState<Account | null>(null);

  const nonArchived = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);
  const totalAll = nonArchived.reduce((sum, account) => sum + account.balanceCents, 0);

  return (
    <div className="space-y-6">
      <section className="border-border bg-card rounded-lg border p-5">
        <p className="text-muted-foreground text-micro">Across your accounts</p>
        <p className="font-mono text-heading mt-1 tabular-nums">
          {formatMoneyCompact(totalAll)}
        </p>
        <div className="mt-4">
          <BalanceBar accounts={accounts} />
        </div>
      </section>

      <section className="border-border bg-card rounded-lg border">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-title">
              Accounts
              {nonArchived.length > 0 && (
                <span className="text-muted-foreground"> · {nonArchived.length}</span>
              )}
            </h2>
            <p className="text-muted-foreground text-micro">
              Where money lives. Every entry lands in one; a transfer moves it
              between them.
            </p>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New account
          </Button>
        </header>

        {nonArchived.length === 0 && archived.length === 0 ? (
          <p className="text-muted-foreground border-t px-4 py-8 text-center text-label">
            No accounts yet. Add your first — every income and expense from
            here on lands in one.
          </p>
        ) : (
          <ul className="divide-y">
            {nonArchived.map((account) => (
              <li key={account.id}>
                <div className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 transition-colors">
                  <button
                    type="button"
                    onClick={() => setOpened(account)}
                    className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[account.color] ?? "var(--muted-foreground)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-title block truncate">
                        {account.name}
                      </span>
                      <span className="text-muted-foreground text-micro">
                        Balance
                      </span>
                    </span>
                    <span className="font-mono text-label shrink-0 tabular-nums">
                      {formatMoneyCompact(account.balanceCents)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferFrom(account)}
                    aria-label={`Move money out of ${account.name}`}
                    title="Move money to another account"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ArrowLeftRight className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpened(account)}
                    aria-label={`Open ${account.name}`}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <div>
            <p className="text-muted-foreground text-micro border-t px-4 pt-3 pb-1">
              These still hold money; they just don&apos;t take new entries.
            </p>
            <ul className="divide-y">
              {archived.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setOpened(account)}
                    className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[account.color] ?? "var(--muted-foreground)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground text-title block truncate">
                        {account.name}
                      </span>
                    </span>
                    <span className="text-muted-foreground font-mono text-label shrink-0 tabular-nums">
                      {formatMoneyCompact(account.balanceCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <AccountSheet
        account={opened}
        monthISO={monthISO}
        onClose={() => setOpened(null)}
      />

      <Dialog open={newOpen} onOpenChange={(open) => !open && setNewOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New account</DialogTitle>
            <DialogDescription>
              A place money lives. Add an opening balance if some is already
              there.
            </DialogDescription>
          </DialogHeader>
          <AccountForm onSuccess={() => setNewOpen(false)} />
        </DialogContent>
      </Dialog>

      {transferFrom && (
        <TransferDialog
          key={`transfer-${transferFrom.id}`}
          accounts={nonArchived}
          defaultFrom={transferFrom.id}
          todayISO={todayISO}
          onClose={() => setTransferFrom(null)}
        />
      )}
    </div>
  );
}