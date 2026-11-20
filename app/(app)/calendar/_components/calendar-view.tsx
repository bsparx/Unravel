"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { isCalendarColor } from "@/lib/calendar-colors";
import type { PlanDragItem } from "@/lib/plan-drag";
import type { PrayerBand } from "@/lib/prayers";
import type { CalendarBlock } from "@/lib/time-blocks";
import { idleState } from "@/lib/validation";

import { addTaskToBlock, scheduleTask } from "../actions";
import type { AnchorRect } from "../_lib/block-widget";
import { BlockDialog, type BlockDraft } from "./block-dialog";
import {
  CalendarGrid,
  NowProvider,
  type DraftPreview,
  type GridDay,
} from "./calendar-grid";

/**
 * Owns the one piece of state the calendar genuinely needs on the client: which
 * block, if any, is open in the editor. Everything else is server data.
 */
export function CalendarView({
  days,
  blocks,
  prayerBands,
  todayISO,
  anchorISO,
  focusBlockId,
  timeZone,
  tasks,
  identities,
}: {
  days: GridDay[];
  blocks: CalendarBlock[];
  prayerBands: Record<string, PrayerBand[]>;
  todayISO: string;
  anchorISO: string;
  /** `?block=` — a block `/day` linked straight to. */
  focusBlockId: string | null;
  timeZone: string;
  /** `cueTitle` is set for a habit that brings a precursor block with it;
      `color` is the task's calendar hue, shown when the editor opens. */
  tasks: {
    id: string;
    title: string;
    cueTitle: string | null;
    color: string;
  }[];
  /** For the editor's "Time for" field. */
  identities: { id: string; name: string; colorSlot: number }[];
}) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [, startTransition] = useTransition();

  // Stable identity: the dialog's toast effect depends on it, and a fresh
  // function every render would re-run that effect on every CalendarView
  // render — including the 30-second now-tick.
  const closeDialog = useCallback(() => {
    setDraft(null);
    setAnchorRect(null);
    setPreview(null);
  }, []);

  // Stable for the same reason, and one more: the grid's columns and chips are
  // memoised, and a handler that changed identity every render would undo it.
  const onDropItem = useCallback(
    (item: PlanDragItem, dateISO: string, startMinute: number) => {
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
          toast.success(result.message ?? `${item.title} blocked out.`);
      });
    },
    [],
  );

  const onCreate = useCallback(
    (
      dateISO: string,
      span: { startMinute: number; endMinute: number },
      rect?: AnchorRect,
    ) => {
      setAnchorRect(rect ?? null);
      setPreview({
        dateISO,
        startMinute: span.startMinute,
        endMinute: span.endMinute,
        title: "",
        kind: "WORK",
        identityColorSlot: null,
        taskColor: null,
      });
      setDraft({
        dateISO,
        ...span,
        title: "",
        notes: "",
        taskIds: [],
        tasks: [],
        taskColor: null,
        kind: "WORK",
        hasCue: false,
        identityId: null,
        beatMinutes: null,
      });
    },
    [],
  );

  const onEdit = useCallback((block: CalendarBlock, rect?: AnchorRect) => {
    setAnchorRect(rect ?? null);
    setPreview(null);
    setDraft({
      id: block.id,
      dateISO: block.dateISO,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      title: block.title,
      notes: block.notes ?? "",
      taskIds: block.tasks.map((task) => task.id),
      // Carried, not re-looked-up: the panel beside the grid deliberately
      // omits whatever is already on the day, so the editor cannot ask it
      // what a saved block holds.
      tasks: block.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        color: task.color,
      })),
      taskColor:
        block.tasks.length === 1 && isCalendarColor(block.tasks[0].color)
          ? block.tasks[0].color
          : null,
      kind: block.kind,
      hasCue: block.hasCue,
      identityId: block.identity?.id ?? null,
      beatMinutes: block.beatMinutes,
    });
  }, []);

  const onDropOnBlock = useCallback((item: PlanDragItem, block: CalendarBlock) => {
    // Dropping onto a block that is already there means "this belongs in
    // that time", not "put a second block on the same minutes". Only a
    // drop on empty grid still makes a new one.
    const already = block.tasks.some((task) => task.id === item.id);
    if (already) {
      toast.info(`${item.title} is already in that block.`);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("blockId", block.id);
      formData.set("taskId", item.id);
      await addTaskToBlock(formData);
      // The block's own name when it has one, otherwise "that block" —
      // "Added to 3 tasks" would be counting the old list back at you.
      toast.success(
        block.title
          ? `Added to ${block.title}.`
          : `Added to that block. It now holds ${block.tasks.length + 1} tasks.`,
      );
    });
  }, []);

  return (
    <>
      <NowProvider timeZone={timeZone}>
        <CalendarGrid
          key={`${anchorISO}-${days.length}-${focusBlockId ?? ""}`}
          days={days}
          blocks={blocks}
          prayerBands={prayerBands}
          todayISO={todayISO}
          anchorISO={anchorISO}
          focusBlockId={focusBlockId}
          draftPreview={preview}
          onCreate={onCreate}
          onEdit={onEdit}
          onDropItem={onDropItem}
          onDropOnBlock={onDropOnBlock}
        />
      </NowProvider>

      {draft && (
        // Keyed so opening a different block remounts the form with that
        // block's times, rather than copying props into state in an effect.
        <BlockDialog
          key={draft.id ?? `new-${draft.dateISO}-${draft.startMinute}`}
          draft={draft}
          anchorRect={anchorRect}
          tasks={tasks}
          identities={identities}
          onPreviewChange={setPreview}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
