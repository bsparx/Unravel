import { addDays, dayOfWeek, toISODate, WEEKDAYS } from "@/lib/dates";
import type { QuotaTier } from "@/lib/quota";
import { isDueOn, type RecurrenceRule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

/**
 * Eight weeks of adherence, one column per week.
 *
 * Days the habit was never due are drawn as nothing at all — that's the whole
 * point of the sparse model. A Mon/Wed/Fri habit should not look like it's
 * failing four days a week.
 */
export function HabitGrid({
  rule,
  history,
  tiers,
  today,
  weeks = 8,
}: {
  rule: RecurrenceRule;
  history: Map<string, "DONE" | "SKIPPED">;
  /** Optional: when present, optimal days are drawn a shade stronger. */
  tiers?: Map<string, QuotaTier>;
  today: Date;
  weeks?: number;
}) {
  // Wind back to the Sunday that starts the earliest visible week.
  const end = addDays(today, 6 - dayOfWeek(today));
  const start = addDays(end, -(weeks * 7 - 1));

  const columns: Date[][] = [];
  for (let week = 0; week < weeks; week += 1) {
    const column: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      column.push(addDays(start, week * 7 + day));
    }
    columns.push(column);
  }

  return (
    <div className="flex gap-[3px]" role="img" aria-label={describe(history)}>
      {columns.map((column, index) => (
        <div key={index} className="flex flex-col gap-[3px]">
          {column.map((date) => {
            const iso = toISODate(date);
            const isFuture = date.getTime() > today.getTime();
            const due = !isFuture && isDueOn(rule, date);
            const status = history.get(iso);
            const tier = tiers?.get(iso);
            const optimal = tier === "OPTIMAL";

            return (
              <span
                key={iso}
                title={`${WEEKDAYS[dayOfWeek(date)].short} ${iso}${
                  due
                    ? status === "DONE"
                      ? optimal
                        ? " — optimal"
                        : " — minimum"
                      : status
                        ? ` — ${status.toLowerCase()}`
                        : " — missed"
                    : ""
                }`}
                className={cn(
                  "size-[9px] rounded-[2px]",
                  // Days the habit was never due stay quiet but still hold
                  // their place, so the grid reads as a calendar rather than
                  // as a broken row.
                  !due && "bg-muted",
                  // Two weights for DONE, because the distinction between "kept
                  // the streak" and "had a good day" is the whole point of two
                  // quotas — and a single colour throws it away.
                  due && status === "DONE" && (optimal ? "bg-primary" : "bg-primary/55"),
                  due && status === "SKIPPED" && "bg-primary/20",
                  due && !status && "border-destructive/40 border bg-transparent",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function describe(history: Map<string, "DONE" | "SKIPPED">) {
  const done = [...history.values()].filter((value) => value === "DONE").length;
  return `${done} completed day${done === 1 ? "" : "s"} in the last eight weeks`;
}
