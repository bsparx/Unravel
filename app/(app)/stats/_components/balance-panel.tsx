import { Moon, Zap } from "lucide-react";

import { formatDuration } from "@/lib/dates";
import type { StatsData } from "../_lib/queries";

/**
 * Work and recovery, side by side, on one shared scale.
 *
 * Same panel width, same bar height, same type scale, same treatment. If
 * recovery rendered as a thin sliver in a legend it would have failed in
 * exactly the way a countdown on the recovery timer would have — the claim of
 * this app is that rest is the other half of the cycle, and the chart has to
 * say that too.
 */
export function BalancePanel({ balance }: { balance: StatsData["balance"] }) {
  const max = Math.max(balance.workSeconds, balance.recoverySeconds, 1);

  const rows = [
    {
      key: "work",
      label: "Work",
      icon: Zap,
      seconds: balance.workSeconds,
      bar: "bg-primary",
      text: "text-primary",
    },
    {
      key: "recovery",
      label: "Recovery",
      icon: Moon,
      seconds: balance.recoverySeconds,
      bar: "bg-rest",
      text: "text-rest",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-label">
                <row.icon className={`size-4 ${row.text}`} aria-hidden />
                {row.label}
              </span>
              <span className="font-mono text-title tabular-nums">
                {formatDuration(row.seconds)}
              </span>
            </div>
            <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${row.bar}`}
                style={{
                  width: `${row.seconds === 0 ? 0 : Math.max(3, (row.seconds / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-body">{balance.sentence}</p>

      {balance.daysWithNoRecovery > 0 && (
        <p className="text-muted-foreground text-label">
          <span className="text-foreground tabular-nums">
            {balance.daysWithNoRecovery}
          </span>{" "}
          {balance.daysWithNoRecovery === 1 ? "day" : "days"} in this range you
          worked and logged no recovery at all.
        </p>
      )}
    </div>
  );
}
