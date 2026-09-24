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
  const [logTarget, setLogTarget] = useState<{
    item: TodayItem;
    askTime: boolean;
  } | null>(null);

  // Ticking done with a question hanging over it is gated in TaskRow: the
  // transition is never started, so the box stays idle. The question is
  // "write the note" for feedback habits (no note yet) and "how long did that
  // take" for todos with nothing on the clock. A habit's tick is never gated
  // on time — the minimal task is a claim, and a claim needs no clock. This
  // is where we open the dialog — nothing is written until it answers.
  const toggle = async (item: TodayItem, next: boolean) => {
    const needsTime =
      item.type !== "HABIT" && item.loggedSeconds === 0 && !item.done;
    const needsFeedback = item.requiresFeedback && !item.feedbackNote;
    if (next && (needsTime || needsFeedback)) {
      setLogTarget({ item, askTime: needsTime });
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

    if (target.item.type === "HABIT") {
      const formData = new FormData();
      formData.set("taskId", target.item.id);
      formData.set("date", todayISO);
      if (result.minutes) formData.set("minutes", String(result.minutes));
      if (result.note) formData.set("note", result.note);
      const state = await completeWithNote(formData);
      if (state.status === "error") toast.error(state.message);
      return;
    }

    if (result.minutes === undefined) return;
    const formData = new FormData();
    formData.set("taskId", target.item.id);
    formData.set("date", todayISO);
    formData.set("minutes", String(result.minutes));
    await logAndComplete(formData);
  };

  // The quest counters: done over done-and-still-open, per section. Done
  // items live in `completedToday` alongside their section's open ones, so
  // the pair is assembled here — "2/4" reads as progress, not as debt.
  const doneHabits = view.completedToday.filter(
    (item) => item.type === "HABIT",
  ).length;
  const doneDueToday = view.completedToday.filter(
    (item) => item.type === "TODO" && item.daysUntilDue === 0,
  ).length;
  const doneUndated = view.completedToday.filter(
    (item) => item.type === "TODO" && item.daysUntilDue === null,
  ).length;

  const sections: {
    key: string;
    heading: string;
    items: TodayItem[];
    tone?: "overdue";
    /** Done today, for the section's "2/4" counter. */
    done?: number;
  }[] = [
    { key: "overdue", heading: "Overdue", items: view.overdue, tone: "overdue" },
    { key: "habits", heading: "Dailies", items: view.habits, done: doneHabits },
    { key: "due", heading: "Quests", items: view.dueToday, done: doneDueToday },
    { key: "undated", heading: "Side quests", items: view.undated, done: doneUndated },
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
          title="No quests yet"
          description="Add the first thing on your mind above, or claim time for it on the calendar. One line is enough."
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
              {/* Overdue counts what's wrong; the quest sections read as a
                  game's counter — done over total, a number that only climbs
                  until the section empties out. */}
              <span className="ml-2 tabular-nums opacity-60">
                {section.tone === "overdue"
                  ? section.items.length
                  : `${section.done ?? 0}/${(section.done ?? 0) + section.items.length}`}
              </span>
            </h2>

            <ul>
              {section.items.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  onToggle={(next) => toggle(item, next)}
                  onEditNote={
                    item.requiresFeedback
                      ? () => setLogTarget({ item, askTime: false })
                      : undefined
                  }
                  onLogTime={() => setLogTarget({ item, askTime: true })}
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
            Completed
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
                  item.requiresFeedback
                    ? () => setLogTarget({ item, askTime: false })
                    : undefined
                }
                onLogTime={() => setLogTarget({ item, askTime: true })}
              />
            ))}
          </ul>
        </section>
      )}

      {logTarget && (
        <LogTimeDialog
          key={logTarget.item.id}
          item={logTarget.item}
          needsTime={logTarget.askTime}
          onConfirm={(result) => void closeLogDialog(result)}
          onCancel={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}
