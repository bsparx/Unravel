"use client";

import { useState } from "react";
import { CheckCircle2, Sun } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import {
  completeWithNote,
  logAndComplete,
  toggleOccurrence,
  toggleTodo,
} from "@/app/(app)/tasks/actions";
import { formatRelativeDate } from "@/lib/dates";
import type { TodayItem, TodayView } from "@/lib/tasks";
import type { WaterToday } from "@/lib/water-data";

import { LogTimeDialog } from "./log-time-dialog";
import { TaskRow } from "./task-row";
import { WaterRow } from "./water-row";

export function DayList({
  view,
  todayISO,
  water,
  timezone,
}: {
  view: TodayView;
  todayISO: string;
  water: WaterToday;
  timezone: string;
}) {
  const [logTarget, setLogTarget] = useState<TodayItem | null>(null);

  // Ticking done with a question hanging over it is gated in TaskRow: the
  // transition is never started, so the box stays idle. The question is either
  // "how long did that take" (nothing logged) or, for feedback habits, "write
  // the note" (no note yet). This is where we open the dialog — nothing is
  // written until the dialog answers.
  const toggle = async (item: TodayItem, next: boolean) => {
    const needsTime = item.loggedSeconds === 0 && !item.done;
    const needsFeedback = item.requiresFeedback && !item.feedbackNote;
    if (next && (needsTime || needsFeedback)) {
      setLogTarget(item);
      return;
    }

    const formData = new FormData();
    formData.set("taskId", item.id);

    if (item.type === "HABIT") {
      formData.set("date", todayISO);
      formData.set("status", next ? "DONE" : "PENDING");
      await toggleOccurrence(formData);
      return;
    }

    formData.set("done", String(next));
    await toggleTodo(formData);
  };

  const closeLogDialog = async (result: { minutes?: number; note?: string }) => {
    const target = logTarget;
    setLogTarget(null);
    if (!target) return;

    if (target.type === "HABIT") {
      const formData = new FormData();
      formData.set("taskId", target.id);
      formData.set("date", todayISO);
      if (result.minutes) formData.set("minutes", String(result.minutes));
      if (result.note) formData.set("note", result.note);
      const state = await completeWithNote(formData);
      if (state.status === "error") toast.error(state.message);
      return;
    }

    if (result.minutes === undefined) return;
    const formData = new FormData();
    formData.set("taskId", target.id);
    formData.set("date", todayISO);
    formData.set("minutes", String(result.minutes));
    await logAndComplete(formData);
  };

  const sections: {
    key: string;
    heading: string;
    items: TodayItem[];
    tone?: "overdue";
  }[] = [
    { key: "overdue", heading: "Overdue", items: view.overdue, tone: "overdue" },
    { key: "habits", heading: "Habits", items: view.habits },
    { key: "due", heading: "Due today", items: view.dueToday },
    { key: "undated", heading: "Anytime", items: view.undated },
  ];

  const hasAnything = sections.some((section) => section.items.length > 0);

  if (!hasAnything && view.completedToday.length === 0) {
    return (
      <div className="space-y-8">
        <section>
          <h2 className="text-micro text-muted-foreground mb-1 font-sans font-medium tracking-wider uppercase">
            Water
          </h2>
          <ul>
            <WaterRow today={water} timezone={timezone} />
          </ul>
        </section>
        <EmptyState
          icon={Sun}
          title="Nothing on today"
          description="Add the first thing that's on your mind above. One line is enough — you can add a time estimate later."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Water is a daily act whether or not anything else is on today, so it
          sits above the empty state as well as above every section. */}
      <section>
        <h2 className="text-micro text-muted-foreground mb-1 font-sans font-medium tracking-wider uppercase">
          Water
        </h2>
        <ul>
          <WaterRow today={water} timezone={timezone} />
        </ul>
      </section>

      {sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section key={section.key}>
            <h2
              className={`text-micro mb-1 font-sans font-medium tracking-wider uppercase ${
                section.tone === "overdue"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {section.heading}
              <span className="ml-2 tabular-nums opacity-60">
                {section.items.length}
              </span>
            </h2>

            <ul>
              {section.items.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  onToggle={(next) => toggle(item, next)}
                  onEditNote={
                    item.requiresFeedback ? () => setLogTarget(item) : undefined
                  }
                  showDueLabel={
                    item.dueDate && section.key === "overdue"
                      ? formatRelativeDate(item.dueDate, view.date)
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        ))}

      {view.completedToday.length > 0 && (
        <section>
          <h2 className="text-micro text-muted-foreground mb-1 flex items-center gap-1.5 font-sans font-medium tracking-wider uppercase">
            <CheckCircle2 className="text-primary size-3.5" aria-hidden />
            Done today
            <span className="tabular-nums opacity-60">
              {view.completedToday.length}
            </span>
          </h2>

          <ul className="opacity-60 transition-opacity hover:opacity-100">
            {view.completedToday.map((item) => (
              <TaskRow
                key={item.id}
                item={item}
                onToggle={(next) => toggle(item, next)}
                onEditNote={
                  item.requiresFeedback ? () => setLogTarget(item) : undefined
                }
              />
            ))}
          </ul>
        </section>
      )}

      {logTarget && (
        <LogTimeDialog
          key={logTarget.id}
          item={logTarget}
          onConfirm={(result) => void closeLogDialog(result)}
          onCancel={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}
