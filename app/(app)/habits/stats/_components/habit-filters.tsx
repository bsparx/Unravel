"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";

import { RANGE_DAYS, RANGE_OPTIONS, type StatsRange } from "@/lib/habit-range";
import { cn } from "@/lib/utils";

/**
 * Filters live in the URL, not in state.
 *
 * Which means a filtered view is a link: back works, refresh keeps it, and
 * "look at just this habit over 90 days" is something you can bookmark or send
 * to yourself. It also keeps the page a Server Component — the filters are the
 * only interactive part.
 */
export function HabitFilters({
  range,
  selected,
  habits,
}: {
  range: StatsRange;
  selected: string[];
  habits: { id: string; title: string; archived: boolean }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = (next: URLSearchParams) => {
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const setRange = (value: StatsRange) => {
    const next = new URLSearchParams(searchParams);
    next.set("range", value);
    push(next);
  };

  const toggleHabit = (id: string) => {
    const next = new URLSearchParams(searchParams);
    const current = next.getAll("habit");
    next.delete("habit");

    const updated = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];

    for (const value of updated) next.append("habit", value);
    push(next);
  };

  const clearHabits = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("habit");
    push(next);
  };

  // Nothing selected means everything, so "All" is the active chip when the
  // list is empty rather than a separate off state.
  const showingAll = selected.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-micro text-muted-foreground w-16 font-medium tracking-wider uppercase">
          Range
        </span>
        <nav aria-label="Range" className="flex flex-wrap gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              aria-pressed={range === option.value}
              className={cn(
                "focus-visible:ring-ring rounded-full px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                range === option.value
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              <span className="sr-only">
                {" "}
                — {RANGE_DAYS[option.value]} days
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <span className="text-micro text-muted-foreground mt-1.5 w-16 font-medium tracking-wider uppercase">
          Habits
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={clearHabits}
            aria-pressed={showingAll}
            className={cn(
              "focus-visible:ring-ring rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
              showingAll
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            All
          </button>

          {habits.map((habit) => {
            const active = selected.includes(habit.id);
            return (
              <button
                key={habit.id}
                type="button"
                onClick={() => toggleHabit(habit.id)}
                aria-pressed={active}
                className={cn(
                  "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  habit.archived && "opacity-60",
                )}
              >
                {active && <Check className="size-3" aria-hidden />}
                <span className="max-w-40 truncate">{habit.title}</span>
                {habit.archived && (
                  <span className="text-micro opacity-70">archived</span>
                )}
              </button>
            );
          })}

          {!showingAll && (
            <button
              type="button"
              onClick={clearHabits}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-full px-2 py-1 text-label focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-3" aria-hidden />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
