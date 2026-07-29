"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { CalendarBlock } from "@/lib/time-blocks";
import { spanOfLength } from "@/lib/block-math";
import { idleState } from "@/lib/validation";

import { scheduleTask } from "../actions";
import { BlockDialog, type BlockDraft } from "./block-dialog";
import { CalendarGrid, type GridDay } from "./calendar-grid";

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
  tasks: { id: string; title: string }[];
}) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const nowMinute = useNowMinute(timeZone);
  const [, startTransition] = useTransition();

  return (
    <>
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
            else toast.success(`${item.title} — blocked out.`);
          });
        }}
        days={days}
        blocks={blocks}
        nowMinute={nowMinute}
        todayISO={todayISO}
        onCreate={(dateISO, startMinute) => {
          const span = spanOfLength(startMinute, 60);
          setDraft({
            dateISO,
            ...span,
            title: "",
            notes: "",
            taskId: null,
            kind: "WORK",
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
            kind: block.kind,
          })
        }
      />

      {draft && (
        // Keyed so opening a different block remounts the form with that
        // block's times, rather than copying props into state in an effect.
        <BlockDialog
          key={draft.id ?? `new-${draft.dateISO}-${draft.startMinute}`}
          draft={draft}
          tasks={tasks}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}

/**
 * Minutes since local midnight, in the user's timezone.
 *
 * Null on the first render on purpose: the server has no "now" it can agree
 * with the client about to the minute, and rendering a line at a
 * server-computed position would be a guaranteed hydration mismatch on the one
 * element that moves. It appears a frame later instead.
 */
function useNowMinute(timeZone: string): number | null {
  const [minute, setMinute] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());

      const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

      setMinute(value("hour") * 60 + value("minute"));
    };

    read();
    const timer = setInterval(read, 30_000);
    return () => clearInterval(timer);
  }, [timeZone]);

  return minute;
}
