"use client";

import { useActionState, useEffect } from "react";
import {
  CalendarPlus,
  CornerDownRight,
  GripVertical,
  Link2,
  Repeat,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { calendarDotStyle, isCalendarColor } from "@/lib/calendar-colors";
import { formatMinutes, formatRelativeDate } from "@/lib/dates";
import { clearPlanItem, planMinutes, writePlanItem } from "@/lib/plan-drag";
import type { SchedulableItem } from "@/lib/time-blocks";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { scheduleTask } from "../actions";

/**
 * The bridge between the list and the calendar.
 *
 * Two ways across, because they answer different questions. Drag when you know
 * where it goes — the day is in front of you and 2pm is obviously the slot.
 * Press "fit it in" when you don't, and let it land in the first gap big
 * enough. Making you pick a time every time is how a planning panel gets used
 * for the first task and then abandoned.
 */
export function SchedulePanel({
  items,
  dateISO,
  today,
}: {
  items: SchedulableItem[];
  dateISO: string;
  today: Date;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-label">
        Nothing left to schedule. Everything open is already on the day.
      </p>
    );
  }

  // Habits and todos under their own quiet labels, only when both are
  // present — one group needs no heading, and a heading per group is chrome.
  const groups: { label: string; items: SchedulableItem[] }[] = [];
  const habits = items.filter((item) => item.kind === "habit");
  const todos = items.filter((item) => item.kind === "task");
  if (habits.length > 0) groups.push({ label: "Habits", items: habits });
  if (todos.length > 0) groups.push({ label: "Open tasks", items: todos });

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          {groups.length > 1 && (
            <p className="text-micro text-muted-foreground mb-1 ml-1 font-medium tracking-wider uppercase">
              {group.label}
              <span className="tabular-nums"> · {group.items.length}</span>
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <ScheduleRow
                key={item.id}
                item={item}
                dateISO={dateISO}
                today={today}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ScheduleRow({
  item,
  dateISO,
  today,
}: {
  item: SchedulableItem;
  dateISO: string;
  today: Date;
}) {
  const [state, formAction, pending] = useActionState(scheduleTask, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Scheduled.");
    else if (state.status === "error") toast.error(state.message);
  }, [state]);

  const overdue = item.dueDate !== null && item.dueDate.getTime() < today.getTime();
  const minutes = planMinutes(item.estimatedSeconds);

  return (
    <li
      draggable
      onDragStart={(event) =>
        writePlanItem(event.dataTransfer, {
          id: item.id,
          title: item.title,
          minutes,
        })
      }
      onDragEnd={clearPlanItem}
      className={cn(
        "border-border/60 group flex cursor-grab items-start gap-2 border-b py-2 last:border-b-0",
        "hover:bg-accent/40 -mx-2 rounded-md px-2 transition-colors active:cursor-grabbing",
      )}
    >
      <GripVertical
        className="text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5 size-4 shrink-0 transition-colors"
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-label">
          {isCalendarColor(item.color) && (
            <span
              className="mt-0.5 size-2 shrink-0 rounded-full"
              style={calendarDotStyle(item.color)}
              aria-hidden
            />
          )}
          {item.kind === "habit" && (
            <Repeat className="text-primary size-3 shrink-0" aria-hidden />
          )}
          {item.title}
        </p>

        {item.cueTitle && (
          // Fitting this in fits two things in. Saying so before the click is
          // the difference between a helpful default and a surprise.
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-micro">
            <Link2 className="size-3 shrink-0" aria-hidden />
            after {item.cueTitle}
          </p>
        )}

        {item.firstStep && (
          // The first step, not the task, is what tells you whether this is a
          // thing you can start in the 25 minutes you're about to block.
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-micro">
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            {item.firstStep}
          </p>
        )}

        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 text-micro tabular-nums">
          {item.estimatedSeconds ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3" aria-hidden />
              {formatMinutes(item.estimatedSeconds)}
            </span>
          ) : (
            <span className="opacity-70">no estimate · {minutes}m</span>
          )}
          {item.kind === "habit" && <span>due today</span>}
          {item.project && <span>{item.project.name}</span>}
          {item.dueDate && (
            <span className={cn(overdue && "text-destructive")}>
              {formatRelativeDate(item.dueDate, today)}
            </span>
          )}
        </p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="taskId" value={item.id} />
        <input type="hidden" name="date" value={dateISO} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-muted-foreground hover:text-primary shrink-0"
        >
          <CalendarPlus className="size-4" aria-hidden />
          {pending ? "…" : "Fit it in"}
        </Button>
      </form>
    </li>
  );
}
