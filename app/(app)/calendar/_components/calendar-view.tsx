"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { isCalendarColor } from "@/lib/calendar-colors";
import type { CalendarBlock } from "@/lib/time-blocks";
import { idleState } from "@/lib/validation";

import { scheduleTask } from "../actions";
import { BlockDialog, type BlockDraft } from "./block-dialog";
import { CalendarGrid, NowProvider, type GridDay } from "./calendar-grid";

/**
 * Owns the one piece of state the calendar genuinely needs on the client: which
 * block, if any, is open in the editor. Everything else is server data.
 */
export function CalendarView({
  days,
  blocks,
  todayISO,
  timeZone,
  tasks,
}: {
  days: GridDay[];
  blocks: CalendarBlock[];
  todayISO: string;
  timeZone: string;
  /** `cueTitle` is set for a habit that brings a precursor block with it;
      `color` is the task's calendar hue, shown when the editor opens. */
  tasks: {
    id: string;
    title: string;
    cueTitle: string | null;
    color: string;
  }[];
}) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [, startTransition] = useTransition();

  // Stable identity: the dialog's toast effect depends on it, and a fresh
  // function every render would re-run that effect on every CalendarView
  // render — including the 30-second now-tick.
  const closeDialog = useCallback(() => setDraft(null), []);

  return (
    <>
      <NowProvider timeZone={timeZone}>
        <CalendarGrid
          onDropItem={(item, dateISO, startMinute) => {
          startTransition(async () => {
            const formData = new FormData();
            formData.set("taskId", item.id);
            formData.set("date", dateISO);
            formData.set("startMinute", String(startMinute));
            formData.set("minutes", String(item.minutes));

            // Dropping names the time, so the action's "find me a gap" path is
            // bypassed — landing somewhere other than where you let go would
            // make the drag a lie.
            const result = await scheduleTask(idleState, formData);
            if (result.status === "error") toast.error(result.message);
            // The server's own message, because it's the only side that knows
            // whether a cue came along — and getting two blocks from one drop
            // needs saying.
            else if (result.status === "success")
              toast.success(result.message ?? `${item.title} — blocked out.`);
          });
        }}
        days={days}
        blocks={blocks}
        todayISO={todayISO}
        onCreate={(dateISO, span) => {
          setDraft({
            dateISO,
            ...span,
            title: "",
            notes: "",
            taskId: null,
            taskColor: null,
            kind: "WORK",
            hasCue: false,
          });
        }}
        onEdit={(block: CalendarBlock) =>
          setDraft({
            id: block.id,
            dateISO: block.dateISO,
            startMinute: block.startMinute,
            endMinute: block.endMinute,
            title: block.title,
            notes: block.notes ?? "",
            taskId: block.task?.id ?? null,
            taskColor:
              block.task && isCalendarColor(block.task.color)
                ? block.task.color
                : null,
            kind: block.kind,
            hasCue: block.hasCue,
          })
        }
      />
      </NowProvider>

      {draft && (
        // Keyed so opening a different block remounts the form with that
        // block's times, rather than copying props into state in an effect.
        <BlockDialog
          key={draft.id ?? `new-${draft.dateISO}-${draft.startMinute}`}
          draft={draft}
          tasks={tasks}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
