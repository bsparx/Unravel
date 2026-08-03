import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CATEGORY_COLORS } from "@/lib/money-palette";
import { formatMoneyCompact } from "@/lib/money";

import type { Account } from "../_lib/queries";

/**
 * Where the month's money actually lives, at a glance: one row per live
 * account with its balance, and a thin bar showing each account's share of
 * the total. Quiet by design — the jar on the hero answers "how much", this
 * answers "where". Archived accounts stay on the accounts page.
 */
export function AccountsStrip({ accounts }: { accounts: Account[] }) {
  const live = accounts.filter((account) => !account.archived);
  if (live.length === 0) return null;

  const total = live.reduce((sum, account) => sum + account.balanceCents, 0);

  return (
    <section className="border-border bg-card mb-6 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-title">Accounts</h2>
        <Link
          href="/budget/accounts"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Manage
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      <div className="mt-2.5 flex h-2 w-full gap-px overflow-hidden rounded-full">
        {total > 0 ? (
          live.map((account) => {
            const share = account.balanceCents / total;
            if (share <= 0) return null;
            return (
              <div
                key={account.id}
                className="h-2"
                style={{
                  width: `${share * 100}%`,
                  backgroundColor:
                    CATEGORY_COLORS[account.color] ?? "var(--muted-foreground)",
                }}
              />
            );
          })
        ) : (
          <div className="bg-accent h-2 flex-1" aria-hidden />
        )}
      </div>

      <ul className="mt-2 divide-y">
        {live.map((account) => (
          <li key={account.id} className="flex items-center gap-2.5 py-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  CATEGORY_COLORS[account.color] ?? "var(--muted-foreground)",
              }}
            />
            <span className="text-title min-w-0 flex-1 truncate">
              {account.name}
            </span>
            <span className="font-mono text-label shrink-0 tabular-nums">
              {formatMoneyCompact(account.balanceCents)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}