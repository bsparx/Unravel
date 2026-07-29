import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type BarRow = {
  key: string;
  label: string;
  sublabel?: string;
  seconds: number;
  /** Amber is reserved for the clock; only pass this where the series genuinely
   *  is "time spent running the timer". */
  tone?: "primary" | "running";
};

export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(...rows.map((row) => row.seconds), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-4 text-label">
            <span className="truncate">
              {row.label}
              {row.sublabel && (
                <span className="text-muted-foreground ml-2 text-micro">
                  {row.sublabel}
                </span>
              )}
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {formatDuration(row.seconds)}
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full",
                row.tone === "running" ? "bg-running" : "bg-primary",
              )}
              style={{ width: `${Math.max(2, (row.seconds / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
