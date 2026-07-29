"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, GripHorizontal, Play } from "lucide-react";

import {
  clampSpan,
  formatMinuteOfDay,
  formatSpanLength,
  layoutColumns,
  MINUTES_PER_DAY,
  snap,
  SNAP_MINUTES,
  spanMinutes,
} from "@/lib/block-math";
import {
  activePlanItem,
  isPlanItemDrag,
  readPlanItem,
  type PlanDragItem,
} from "@/lib/plan-drag";
import type { CalendarBlock } from "@/lib/time-blocks";
import { buildTimerHref } from "@/lib/timer-url";
import { toWorkMode } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

import { moveBlock, toggleBlockDone } from "../actions";

/**
 * Vertical scale. One pixel per minute makes an hour 60px — tall enough that a
 * 15-minute block is a real object you can hit with a finger, short enough
 * that a working day fits on a laptop screen without scrolling to find lunch.
 */
const MINUTE_PX = 1;
/** Anything shorter renders its label on one line instead of two. */
const COMPACT_MINUTES = 45;

export type GridDay = { dateISO: string; label: string; weekday: string; isToday: boolean };

export function CalendarGrid({
  days,
  blocks,
  nowMinute,
  todayISO,
  onCreate,
  onEdit,
  onDropItem,
}: {
  days: GridDay[];
  blocks: CalendarBlock[];
  /** Minutes since local midnight, resolved server-side. Null when not today. */
  nowMinute: number | null;
  todayISO: string;
  onCreate: (dateISO: string, startMinute: number) => void;
  onEdit: (block: CalendarBlock) => void;
  /** Something was dragged in from the panel and let go at `startMinute`. */
  onDropItem: (item: PlanDragItem, dateISO: string, startMinute: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // The optimistic layer is what makes dragging feel like moving an object
  // rather than submitting a form. The server is authoritative; this just
  // stops the block snapping back for one round trip.
  const [shown, applyMove] = useOptimistic(
    blocks,
    (
      current,
      move: { id: string; dateISO: string; startMinute: number; endMinute: number },
    ) =>
      current.map((block) =>
        block.id === move.id ? { ...block, ...move } : block,
      ),
  );

  const [drag, setDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    dateISO: string;
    startMinute: number;
    endMinute: number;
  } | null>(null);

  // Open on the working day, not on midnight. Scrolling past eight empty hours
  // every time you open the calendar is a small tax you'd pay hundreds of times.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const earliest = blocks.length
      ? Math.min(...blocks.map((block) => block.startMinute))
      : 8 * 60;
    container.scrollTop = Math.max(0, (Math.min(earliest, 8 * 60) - 30) * MINUTE_PX);
    // Only on mount: re-running this would yank the viewport away mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: NonNullable<typeof drag>) => {
    const span = clampSpan(next.startMinute, next.endMinute);
    const payload = { id: next.id, dateISO: next.dateISO, ...span };

    startTransition(async () => {
      applyMove(payload);
      const formData = new FormData();
      formData.set("id", next.id);
      formData.set("date", next.dateISO);
      formData.set("startMinute", String(span.startMinute));
      formData.set("endMinute", String(span.endMinute));
      await moveBlock(formData);
    });
  };

  const toggleDone = (block: CalendarBlock) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", block.id);
      formData.set("done", String(block.completedAt === null));
      await toggleBlockDone(formData);
    });
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      {/* Day headings, outside the scroller so they stay put. */}
      <div
        className="border-border bg-card/80 grid border-b backdrop-blur"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div aria-hidden />
        {days.map((day) => (
          <div
            key={day.dateISO}
            className={cn(
              "border-border/60 border-l px-2 py-2 text-center",
              day.isToday && "bg-accent/40",
            )}
          >
            <p
              className={cn(
                "text-micro font-medium tracking-wider uppercase",
                day.isToday ? "text-primary" : "text-muted-foreground",
              )}
            >
              {day.weekday}
            </p>
            <p
              className={cn(
                "text-title tabular-nums",
                day.isToday && "text-primary font-medium",
              )}
            >
              {day.label}
            </p>
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[68vh] overflow-y-auto overscroll-contain"
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
            height: MINUTES_PER_DAY * MINUTE_PX,
          }}
        >
          <HourGutter />

          {days.map((day) => (
            <DayColumn
              key={day.dateISO}
              day={day}
              blocks={shown.filter((block) => block.dateISO === day.dateISO)}
              nowMinute={day.dateISO === todayISO ? nowMinute : null}
              drag={drag}
              setDrag={setDrag}
              commit={commit}
              onCreate={onCreate}
              onEdit={onEdit}
              onToggleDone={toggleDone}
              onDropItem={onDropItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HourGutter() {
  return (
    <div className="relative">
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="text-muted-foreground absolute right-2 -translate-y-1/2 text-micro tabular-nums"
          style={{ top: hour * 60 * MINUTE_PX }}
        >
          {hour === 0 ? "" : formatMinuteOfDay(hour * 60)}
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  day,
  blocks,
  nowMinute,
  drag,
  setDrag,
  commit,
  onCreate,
  onEdit,
  onToggleDone,
  onDropItem,
}: {
  day: GridDay;
  blocks: CalendarBlock[];
  nowMinute: number | null;
  drag: {
    id: string;
    mode: "move" | "resize";
    dateISO: string;
    startMinute: number;
    endMinute: number;
  } | null;
  setDrag: (
    next: {
      id: string;
      mode: "move" | "resize";
      dateISO: string;
      startMinute: number;
      endMinute: number;
    } | null,
  ) => void;
  commit: (next: {
    id: string;
    mode: "move" | "resize";
    dateISO: string;
    startMinute: number;
    endMinute: number;
  }) => void;
  onCreate: (dateISO: string, startMinute: number) => void;
  onEdit: (block: CalendarBlock) => void;
  onToggleDone: (block: CalendarBlock) => void;
  onDropItem: (item: PlanDragItem, dateISO: string, startMinute: number) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);

  // Where a dragged-in item would land, in minutes. Null when nothing of ours
  // is over this column.
  const [dropMinute, setDropMinute] = useState<number | null>(null);

  /** Where in the day a pointer is, in minutes. */
  const minuteAt = (clientY: number): number => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return snap((clientY - rect.top) / MINUTE_PX);
  };

  const beginDrag = (
    event: React.PointerEvent,
    block: CalendarBlock,
    mode: "move" | "resize",
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);

    const grabbedAt = minuteAt(event.clientY);
    const offset = grabbedAt - block.startMinute;
    const length = spanMinutes(block);

    let latest = {
      id: block.id,
      mode,
      dateISO: day.dateISO,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
    };
    setDrag(latest);

    const onMove = (moveEvent: PointerEvent) => {
      const minute = minuteAt(moveEvent.clientY);
      latest =
        mode === "move"
          ? {
              ...latest,
              startMinute: Math.max(0, minute - offset),
              endMinute: Math.max(0, minute - offset) + length,
            }
          : { ...latest, endMinute: Math.max(block.startMinute + SNAP_MINUTES, minute) };
      setDrag(latest);
    };

    const onUp = () => {
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      setDrag(null);
      // A click that never moved is a click, not a drag — don't write a no-op.
      if (
        latest.startMinute !== block.startMinute ||
        latest.endMinute !== block.endMinute
      ) {
        commit(latest);
      } else if (mode === "move") {
        onEdit(block);
      }
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
  };

  const laid = layoutColumns(
    blocks.map((block) =>
      drag && drag.id === block.id
        ? { ...block, startMinute: drag.startMinute, endMinute: drag.endMinute }
        : block,
    ),
  );

  return (
    <div
      ref={columnRef}
      className={cn(
        "border-border/60 relative border-l",
        day.isToday && "bg-accent/20",
      )}
      onDoubleClick={(event) => {
        const rect = columnRef.current?.getBoundingClientRect();
        if (!rect) return;
        onCreate(day.dateISO, snap((event.clientY - rect.top) / MINUTE_PX));
      }}
      onDragOver={(event) => {
        if (!isPlanItemDrag(event.dataTransfer)) return;
        // Without this the browser treats the column as a non-drop zone and
        // shows the "no entry" cursor.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropMinute(minuteAt(event.clientY));
      }}
      onDragLeave={(event) => {
        // Fires when crossing onto a child too; ignore those, or the preview
        // strobes as the pointer moves over each half-hour target.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setDropMinute(null);
      }}
      onDrop={(event) => {
        const item = readPlanItem(event.dataTransfer);
        setDropMinute(null);
        if (!item) return;
        event.preventDefault();
        onDropItem(item, day.dateISO, minuteAt(event.clientY));
      }}
    >
      {/* Hour lines. Half-hours are lighter, so the grid reads as hours first. */}
      {Array.from({ length: 48 }, (_, half) => (
        <div
          key={half}
          className={cn(
            "pointer-events-none absolute inset-x-0",
            half % 2 === 0 ? "border-border/50 border-t" : "border-border/25 border-t",
          )}
          style={{ top: half * 30 * MINUTE_PX }}
        />
      ))}

      {/* Click targets, one per half hour. A div with an onClick would swallow
          block clicks; these sit underneath, at z-0. */}
      {Array.from({ length: 48 }, (_, half) => (
        <button
          key={half}
          type="button"
          aria-label={`Block out ${formatMinuteOfDay(half * 30)} on ${day.label}`}
          onClick={() => onCreate(day.dateISO, half * 30)}
          className="hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:ring-ring absolute inset-x-0 focus-visible:ring-1 focus-visible:outline-none"
          style={{ top: half * 30 * MINUTE_PX, height: 30 * MINUTE_PX }}
        />
      ))}

      {nowMinute !== null && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20"
          style={{ top: nowMinute * MINUTE_PX }}
        >
          <div className="bg-running relative h-px">
            <span className="bg-running absolute -top-1 -left-1 size-2 rounded-full" />
          </div>
        </div>
      )}

      {/* Where it would land, at the length it would be. A drop indicator that
          only marks the start minute leaves you guessing whether a 90-minute
          task clears the thing below it — which is the actual question. */}
      {dropMinute !== null && (
        <DropPreview
          startMinute={dropMinute}
          minutes={activePlanItem()?.minutes ?? 25}
          title={activePlanItem()?.title ?? ""}
        />
      )}

      {laid.map(({ block, column, columns }) => (
        <BlockChip
          key={block.id}
          block={block}
          column={column}
          columns={columns}
          dragging={drag?.id === block.id}
          onPointerDown={(event, mode) => beginDrag(event, block, mode)}
          onToggleDone={() => onToggleDone(block)}
        />
      ))}
    </div>
  );
}

function DropPreview({
  startMinute,
  minutes,
  title,
}: {
  startMinute: number;
  minutes: number;
  title: string;
}) {
  return (
    <div
      className="border-primary bg-primary/15 text-foreground pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-md border border-dashed px-2 py-1"
      style={{
        top: startMinute * MINUTE_PX,
        height: Math.max(18, minutes * MINUTE_PX - 2),
      }}
    >
      <p className="truncate text-label leading-4 font-medium">{title}</p>
      <p className="text-muted-foreground text-micro tabular-nums">
        {formatMinuteOfDay(startMinute)} –{" "}
        {formatMinuteOfDay(startMinute + minutes)}
      </p>
    </div>
  );
}

/**
 * Colour is by *kind*, never by state.
 *
 * Amber stays reserved for a clock that is actually running — the now-line is
 * the only amber on this screen, and a planned block borrowing it would make
 * the whole day look like it was in progress.
 */
const KIND_STYLES = {
  WORK: "bg-primary/12 border-primary/45 text-foreground",
  RECOVERY: "bg-rest-muted border-rest/45 text-foreground",
  BUFFER: "bg-muted border-border text-muted-foreground border-dashed",
} as const;

function BlockChip({
  block,
  column,
  columns,
  dragging,
  onPointerDown,
  onToggleDone,
}: {
  block: CalendarBlock;
  column: number;
  columns: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent, mode: "move" | "resize") => void;
  onToggleDone: () => void;
}) {
  const minutes = spanMinutes(block);
  const compact = minutes < COMPACT_MINUTES;
  const done = block.completedAt !== null;

  const width = `calc(${100 / columns}% - 4px)`;
  const left = `calc(${(column * 100) / columns}% + 2px)`;

  return (
    <div
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border px-2 py-1 select-none",
        "transition-shadow duration-150 hover:shadow-sm",
        KIND_STYLES[block.kind],
        done && "opacity-55",
        dragging && "z-30 cursor-grabbing shadow-md",
        !dragging && "cursor-grab",
      )}
      style={{
        top: block.startMinute * MINUTE_PX,
        height: Math.max(18, minutes * MINUTE_PX - 2),
        width,
        left,
      }}
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      <div className={cn("flex min-w-0 items-start gap-1.5", compact && "items-center")}>
        <button
          type="button"
          aria-label={done ? `Untick ${block.title}` : `Tick off ${block.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }}
          className={cn(
            "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-current/40 hover:border-current",
          )}
        >
          {/* Hidden until ticked or hovered. A check drawn faintly inside every
              block makes a freshly planned day read as one you already did. */}
          <Check
            className={cn(
              "size-2.5 transition-opacity",
              done ? "opacity-100" : "opacity-0 group-hover:opacity-45",
            )}
            strokeWidth={3}
            aria-hidden
          />
        </button>

        <p
          className={cn(
            "min-w-0 flex-1 text-label leading-4 font-medium",
            // A tall block has the room for two lines, and "Write…" in a
            // 90-minute box is throwing away the space that makes a week view
            // readable at a glance.
            compact ? "truncate" : "line-clamp-2",
            done && "line-through",
          )}
        >
          {block.title}
        </p>

        {block.task && !done && (
          <Link
            href={buildTimerHref({
              id: block.task.id,
              estimatedSeconds: minutes * 60,
              defaultMode: toWorkMode(block.task.defaultMode),
              plannedIntervals: block.task.plannedIntervals,
            })}
            aria-label={`Start a timer for ${block.title}`}
            onPointerDown={(event) => event.stopPropagation()}
            className="text-muted-foreground hover:text-primary shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Play className="size-3" aria-hidden />
          </Link>
        )}
      </div>

      {!compact && (
        <p className="text-muted-foreground mt-0.5 text-micro tabular-nums">
          {formatMinuteOfDay(block.startMinute)} · {formatSpanLength(block)}
        </p>
      )}

      {/* Resize handle. Only appears on hover, so it never competes with the
          block's own content for a 20px-tall block. */}
      <button
        type="button"
        aria-label={`Change the length of ${block.title}`}
        onPointerDown={(event) => onPointerDown(event, "resize")}
        className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 focus-visible:opacity-100"
      >
        <GripHorizontal className="size-3" aria-hidden />
      </button>
    </div>
  );
}
