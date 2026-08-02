import { formatMoneyCompact, formatMoneyWhole } from "@/lib/money";
import { cn } from "@/lib/utils";

import { BalanceVesselLazy } from "./balance-vessel-lazy";

/**
 * The month's story in one spread: the jar on the left, the reading on the
 * right. Everything here is rendered server-side (except the jar's liquid) —
 * a sentence, three numbers, and the deltas against last month. The chips
 * grid the page used to carry is gone: the balance is the one big number,
 * and In and Out are its parts, not its peers.
 */
export function BalancePanel({
  incomeCents,
  expenseCents,
  deltaIncome,
  deltaOut,
  monthLabel,
  paceLine,
  hasData,
}: {
  incomeCents: number;
  expenseCents: number;
  /** vs last month — arrows, coloured by which way is good. */
  deltaIncome: number;
  deltaOut: number;
  monthLabel: string;
  /** A server-computed sentence about the spending pace, or null. */
  paceLine: string | null;
  hasData: boolean;
}) {
  const balance = incomeCents - expenseCents;
  const overspent = balance < 0;

  return (
    <section className="mb-6 grid items-center gap-6 md:grid-cols-[auto_1fr]">
      <BalanceVesselLazy balanceCents={balance} incomeCents={incomeCents} />

      <div className="min-w-0">
        {hasData ? (
          <>
            <p className="text-muted-foreground text-micro uppercase tracking-wider">
              Balance · {monthLabel}
            </p>
            <p
              className={cn(
                "text-display mt-1 font-mono leading-none tabular-nums",
                overspent ? "text-destructive" : "text-foreground",
              )}
            >
              {balance > 0 ? "+" : balance < 0 ? "−" : ""}
              {formatMoneyWhole(Math.abs(balance))}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              <Delta
                label="In"
                amount={incomeCents}
                delta={deltaIncome}
                goodWhenUp
              />
              <Delta
                label="Out"
                amount={expenseCents}
                delta={deltaOut}
                goodWhenUp={false}
              />
            </div>

            {paceLine && (
              <p className="text-muted-foreground mt-4 text-label">{paceLine}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-micro text-muted-foreground uppercase tracking-wider">
              Balance · {monthLabel}
            </p>
            <p className="text-display mt-1 font-mono leading-none tabular-nums text-muted-foreground/50">
              Rs 0
            </p>
            <p className="text-muted-foreground mt-4 text-label">
              The jar is dry. Log what came in and what went out — the level
              is the difference.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * One part of the balance, with the arrow against last month. The arrow is
 * coloured by which direction is good: money in rising is teal, money out
 * rising is clay.
 */
function Delta({
  label,
  amount,
  delta,
  goodWhenUp,
}: {
  label: string;
  amount: number;
  delta: number;
  goodWhenUp: boolean;
}) {
  const flat = delta === 0;
  const good = goodWhenUp ? delta > 0 : delta < 0;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";

  return (
    <div className="min-w-28">
      <p className="text-muted-foreground text-micro">{label}</p>
      <p className="font-mono text-title mt-0.5 tabular-nums">
        {formatMoneyCompact(amount)}
        <span
          className={cn(
            "text-micro ml-2 tabular-nums",
            flat
              ? "text-muted-foreground"
              : good
                ? "text-primary"
                : "text-destructive",
          )}
          title={`vs last month`}
        >
          {arrow} {formatMoneyCompact(Math.abs(delta))}
        </span>
      </p>
    </div>
  );
}
