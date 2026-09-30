"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addDays, dayOfWeek, formatDateWithWeekday, toISODate, WEEKDAYS } from "@/lib/dates";
import { isDueOn, type RecurrenceRule } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

/** Eight weeks of history. Scheduled rest stays neutral; every mark has words. */
export function HabitGrid({
  rule,
  history,
  wentBeyond,
  today,
  weeks = 8,
}: {
  rule: RecurrenceRule;
  history: Map<string, "DONE" | "SKIPPED">;
  wentBeyond?: Map<string, boolean>;
  today: Date;
  weeks?: number;
}) {
  const end = addDays(today, 6 - dayOfWeek(today));
  const start = addDays(end, -(weeks * 7 - 1));
  const dates = Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
  const todayIndex = dates.findIndex((date) => toISODate(date) === toISODate(today));
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, todayIndex));
  const controls = useRef<Array<HTMLButtonElement | null>>([]);
  const descriptionId = useId();

  const outcome = (date: Date) => {
    const iso = toISODate(date);
    if (date.getTime() > today.getTime()) return isDueOn(rule, date) ? "Scheduled" : "Not scheduled";
    const status = history.get(iso);
    if (status === "DONE") return wentBeyond?.get(iso) ? "Completed, with optional extra" : "Completed";
    if (status === "SKIPPED") return "Skipped";
    if (!isDueOn(rule, date)) return "Not scheduled";
    return iso === toISODate(today) ? "Not completed yet" : "No check-in recorded";
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const column = Math.floor(index / 7);
    const row = index % 7;
    let next = index;
    switch (event.key) {
      case "ArrowLeft": next = Math.max(0, column - 1) * 7 + row; break;
      case "ArrowRight": next = Math.min(weeks - 1, column + 1) * 7 + row; break;
      case "ArrowUp": next = column * 7 + Math.max(0, row - 1); break;
      case "ArrowDown": next = column * 7 + Math.min(6, row + 1); break;
      case "Home": next = event.ctrlKey ? 0 : row; break;
      case "End": next = event.ctrlKey ? dates.length - 1 : (weeks - 1) * 7 + row; break;
      default: return;
    }
    event.preventDefault();
    controls.current[next]?.focus();
  };

  return (
    <div className="space-y-3">
      <p id={descriptionId} className="text-label" aria-live="polite" aria-atomic="true">
        <span className="text-muted-foreground">{formatDateWithWeekday(dates[selectedIndex])}: </span>
        {outcome(dates[selectedIndex])}
      </p>
      <p className="text-muted-foreground text-micro">Select a day for its details. Use arrow keys to move through history.</p>
      <div role="grid" aria-label={`Habit history over ${weeks} weeks`} aria-rowcount={7} aria-colcount={weeks} className="w-max space-y-1">
        {WEEKDAYS.map((weekday, row) => (
          <div role="row" key={weekday.short} className="flex items-center gap-1">
            <span aria-hidden className="text-muted-foreground w-8 shrink-0 text-micro">{weekday.short}</span>
            {Array.from({ length: weeks }, (_, column) => {
              const index = column * 7 + row;
              const date = dates[index];
              const iso = toISODate(date);
              const future = date.getTime() > today.getTime();
              const due = !future && isDueOn(rule, date);
              const status = future ? undefined : history.get(iso);
              const completed = status === "DONE";
              const skipped = status === "SKIPPED";
              const selected = index === selectedIndex;

              return (
                <div key={iso} role="gridcell" aria-selected={selected}>
                  <Button
                    type="button"
                    ref={(element) => { controls.current[index] = element; }}
                    variant="ghost"
                    size="icon"
                    tabIndex={selected ? 0 : -1}
                    aria-label={`${formatDateWithWeekday(date)}: ${outcome(date)}`}
                    aria-describedby={descriptionId}
                    onFocus={() => setSelectedIndex(index)}
                    onClick={() => setSelectedIndex(index)}
                    onKeyDown={(event) => moveFocus(event, index)}
                    className={cn("size-11", selected && "bg-muted/60")}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 place-items-center rounded-[7px]",
                        !due && !completed && !skipped && "bg-muted",
                        completed && (wentBeyond?.get(iso) ? "bg-primary text-primary-foreground" : "bg-primary/55 text-foreground"),
                        skipped && "bg-muted text-muted-foreground",
                        due && !status && "border border-muted-foreground/50",
                      )}
                    >
                      {completed && <Check className="size-3" aria-hidden />}
                      {skipped && <Minus className="size-3" aria-hidden />}
                    </span>
                  </Button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
