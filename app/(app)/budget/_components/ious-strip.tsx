import Link from "next/link";
import { ChevronRight, HandCoins } from "lucide-react";

import { formatMoneyCompact } from "@/lib/money";

/**
 * One line pointing at the IOU ledger: what's still owed each way. Promises,
 * not movements, so they stay off every total on the overview.
 */
export function IousStrip({
  iOweCents,
  owedToMeCents,
  open,
}: {
  iOweCents: number;
  owedToMeCents: number;
  open: number;
}) {
  return (
    <Link
      href="/budget/debts"
      className="border-border bg-card hover:bg-accent/40 focus-visible:ring-ring flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none md:px-5"
    >
      <HandCoins className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="text-title">IOUs</span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-label">
        {open === 0 ? (
          "Nothing outstanding"
        ) : (
          <>
            {owedToMeCents > 0 && (
              <>
                Owed to you <span className="text-foreground font-mono tabular-nums">{formatMoneyCompact(owedToMeCents)}</span>
              </>
            )}
            {owedToMeCents > 0 && iOweCents > 0 && " · "}
            {iOweCents > 0 && (
              <>
                You owe <span className="text-foreground font-mono tabular-nums">{formatMoneyCompact(iOweCents)}</span>
              </>
            )}
          </>
        )}
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}
