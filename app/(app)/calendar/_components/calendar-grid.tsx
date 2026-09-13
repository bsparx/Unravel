"use client";

import {
  createContext,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, CornerDownRight, GripHorizontal, Play, X } from "lucide-react";

import {
  BLOCK_MIN_HEIGHT_PX,
  blockLabel,
  blockProgressParts,
  clampSpan,
  formatMinuteOfDay,
  formatSpanLength,
  layoutBlockBody,
  layoutColumns,
  LIST_GAP_PX,
  MIN_BLOCK_MINUTES,
  MINUTES_PER_DAY,
  PLAN_DEFAULT_MINUTES,
  snap,
  SNAP_MINUTES,
  spanMinutes,
  spanOfLength,
  TASK_LINE_PX,
  TASK_ROW_MAX_PX,
  TIGHT_MINUTES,
} from "@/lib/block-math";
import {
  calendarChipStyle,
  calendarInkStyle,
  isCalendarColor,
} from "@/lib/calendar-colors";
import {
  activePlanItem,
  isPlanItemDrag,
  readPlanItem,
  type PlanDragItem,
} from "@/lib/plan-drag";
import type { CalendarBlock, BlockTask } from "@/lib/time-blocks";
import type { PrayerBand } from "@/lib/prayers";
import { buildTimerHref } from "@/lib/timer-url";
import { toWorkMode } from "@/lib/timer-math";
import { abutsNeighbour, transitionsForDay } from "@/lib/transitions";
import { cn } from "@/lib/utils";

import { deleteBlock, moveBlock, toggleBlockDone, toggleBlockTask } from "../actions";
import { PrayerBands } from "./prayer-bands";
import { TransitionStrip } from "./transition-strip";

/**
 * Vertical scale. Two pixels per minute makes an hour 120px — a 15-minute
 * block is 30px tall, a real target instead of a sliver, at the cost of
 * seeing fewer hours per screen.
 */
const MINUTE_PX = 2;
/** Anything shorter renders its label on one line instead of two. */
const COMPACT_MINUTES = 45;

/** The stretch of waking hours the header strips cover. Same window as the
    page's own "how much is left" stat — see WAKING_START/END in page.tsx. */
const STRIP_FROM = 7 * 60;
const STRIP_TO = 22 * 60;

/** Same fill vocabulary as `/day`'s PlanStrip — the strips are that glance,
    held wide enough to show a week. */
const STRIP_FILL = {
  WORK: "bg-primary/70",
  RECOVERY: "bg-rest/70",
  BUFFER: "bg-muted-foreground/25",
  // Filtered out before this map is read — here so the vocabulary stays
  // exhaustive; a dream that ever reached a strip would show as its violet.
  DAYDREAM: "bg-violet-400/40",
} as const;

/**
 * Minutes since local midnight, in the user's timezone.
 *
 * Null on the first render on purpose: the server has no "now" it can agree
 * with the client about to the minute, and rendering a line at a
 * server-computed position would be a guaranteed hydration mismatch on the one
 * element that moves. It appears a frame later instead.
 *
 * The provider holds the grid as a stable child, so the 30-second tick
 * re-renders only itself — and the markers that subscribe through context —
 * instead of the whole grid.
 */
export const NowContext = createContext<number | null>(null);

export function NowProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: ReactNode;
}) {
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

  return <NowContext.Provider value={minute}>{children}</NowContext.Provider>;
}

/** Draws only the marker, wherever in the grid it lives. */
function NowPosition({
  children,
}: {
  children: (minute: number | null) => ReactNode;
}) {
  const minute = useContext(NowContext);
  return <>{children(minute)}</>;
}

export type GridDay = { dateISO: string; label: string; weekday: string; isToday: boolean };

/** What the optimistic layer can do to the day before the server answers. */
type BlockPatch =
  | {
      kind: "move";
      id: string;
      dateISO: string;
      startMinute: number;
      endMinute: number;
    }
  | { kind: "remove"; id: string }
  | { kind: "toggleBlock"; id: string }
  | { kind: "toggleTask"; blockId: string; taskId: string };

/**
 * The block's tick, restated from its task list.
 *
 * A block with tasks is done exactly when all of them are — the server says the
 * same in `reconcileBlockCompletion`, and the two have to agree or the tick
 * flickers back on the round trip.
 */
function withDerivedCompletion(block: CalendarBlock): CalendarBlock {
  if (block.tasks.length === 0) return block;
  const allDone = block.tasks.every((task) => task.doneAt !== null);
  return { ...block, completedAt: allDone ? block.completedAt ?? new Date() : null };
}

function applyToggleTask(
  block: CalendarBlock,
  taskId: string,
): CalendarBlock {
  return withDerivedCompletion({
    ...block,
    tasks: block.tasks.map((task) =>
      task.id === taskId
        ? { ...task, doneAt: task.doneAt === null ? new Date() : null }
        : task,
    ),
  });
}

export function CalendarGrid({
  days,
  blocks,
  prayerBands,
  todayISO,
  onCreate,
  onEdit,
  onDropItem,
  onDropOnBlock,
}: {
  days: GridDay[];
  blocks: CalendarBlock[];
  /** Tinted prayer windows per day ISO — see lib/prayers.ts. */
  prayerBands: Record<string, PrayerBand[]>;
  todayISO: string;
  /** A slot was clicked or dragged into a span: open the editor on it. */
  onCreate: (
    dateISO: string,
    span: { startMinute: number; endMinute: number },
  ) => void;
  onEdit: (block: CalendarBlock) => void;
  /** Something was dragged in from the panel and let go at `startMinute`. */
  onDropItem: (item: PlanDragItem, dateISO: string, startMinute: number) => void;
  /** …and let go *on* a block that already exists: add it to that time. */
  onDropOnBlock: (item: PlanDragItem, block: CalendarBlock) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const nowMinute = useContext(NowContext);
  const [, startTransition] = useTransition();

  // The optimistic layer is what makes dragging feel like moving an object
  // rather than submitting a form. The server is authoritative; this just
  // stops the block snapping back for one round trip.
  const [shown, applyPatch] = useOptimistic(blocks, (current, patch: BlockPatch) => {
    if (patch.kind === "remove") {
      return current.filter((block) => block.id !== patch.id);
    }

    return current.map((block) => {
      if (patch.kind === "toggleTask") {
        return block.id === patch.blockId
          ? applyToggleTask(block, patch.taskId)
          : block;
      }

      if (patch.kind === "toggleBlock" && block.id === patch.id) {
        const done = block.completedAt === null;
        return {
          ...block,
          completedAt: done ? new Date() : null,
          tasks: block.tasks.map((task) => ({
            ...task,
            doneAt: done ? task.doneAt ?? new Date() : null,
          })),
        };
      }

      if (patch.kind !== "move" || block.id !== patch.id) {
        // A cue keeps its place at the front of the block it cues. `moveBlock`
        // does the same on the server; doing it here too is what stops the cue
        // visibly lagging a frame behind the thing it's glued to.
        if (patch.kind === "move" && block.cueForId === patch.id) {
          const length = spanMinutes(block);
          const end = patch.startMinute;
          return {
            ...block,
            dateISO: patch.dateISO,
            startMinute: Math.max(0, end - length),
            endMinute: end,
          };
        }
        return block;
      }

      return {
        ...block,
        dateISO: patch.dateISO,
        startMinute: patch.startMinute,
        endMinute: patch.endMinute,
      };
    });
  });

  const [drag, setDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    dateISO: string;
    startMinute: number;
    endMinute: number;
  } | null>(null);

  // The header strips track the optimistic layer too, so a block in motion
  // is a strip in motion.
  const blocksFor = (dateISO: string) =>
    shown.filter((block) => block.dateISO === dateISO);

  // Open on the working day, not on midnight. Scrolling past eight empty hours
  // every time you open the calendar is a small tax you'd pay hundreds of times.
  // When today is on screen, open at the current time instead — the now-line
  // near the top with ~30 minutes of context above, so arriving at 5pm never
  // means hunting down the afternoon. `nowMinute` is null for one frame after
  // mount (the same tick the now-line waits for), so this fires when it lands.
  useEffect(() => {
    if (nowMinute === null || scrolledRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    scrolledRef.current = true;

    if (days.some((day) => day.dateISO === todayISO)) {
      container.scrollTop = Math.max(0, (nowMinute - 30) * MINUTE_PX);
      return;
    }

    const earliest = blocks.length
      ? Math.min(...blocks.map((block) => block.startMinute))
      : 8 * 60;
    container.scrollTop = Math.max(0, (Math.min(earliest, 8 * 60) - 30) * MINUTE_PX);
    // Only on mount: re-running this would yank the viewport away mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMinute]);

  const commit = (next: NonNullable<typeof drag>) => {
    const span = clampSpan(next.startMinute, next.endMinute);

    startTransition(async () => {
      applyPatch({ kind: "move", id: next.id, dateISO: next.dateISO, ...span });
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
      applyPatch({ kind: "toggleBlock", id: block.id });
      const formData = new FormData();
      formData.set("id", block.id);
      formData.set("done", String(block.completedAt === null));
      await toggleBlockDone(formData);
    });
  };

  /**
   * One line inside a block.
   *
   * The tick is block-scoped and the write lands on the join row — the task
   * itself is untouched. Same rule as the block's own tick: a plan is not the
   * thing, and `toggleBlockDone` would not have it any other way.
   */
  const toggleTask = (block: CalendarBlock, taskId: string) => {
    const done = block.tasks.find((task) => task.id === taskId)?.doneAt === null;
    startTransition(async () => {
      applyPatch({ kind: "toggleTask", blockId: block.id, taskId });
      const formData = new FormData();
      formData.set("blockId", block.id);
      formData.set("taskId", taskId);
      formData.set("done", String(done));
      await toggleBlockTask(formData);
    });
  };

  /**
   * "Not today." Drops the cue block for this one day only — the habit stays put
   * and its definition is untouched, so tomorrow's plan still brings the cue.
   */
  const dropCue = (block: CalendarBlock) => {
    startTransition(async () => {
      applyPatch({ kind: "remove", id: block.id });
      const formData = new FormData();
      formData.set("id", block.id);
      await deleteBlock(formData);
    });
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      {/* Day headings, outside the scroller so they stay put. Each one carries
          a strip of its waking hours — the week's shape read at a glance, and
          the page's legend. */}
      <div
        className="border-border bg-card/80 grid border-b backdrop-blur"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div aria-hidden />
        {days.map((day, index) => (
          <div
            key={day.dateISO}
            className={cn(
              "border-border/60 border-l px-2 pt-2 pb-1.5 text-center",
              day.isToday && "bg-accent/40",
            )}
          >
            <p
              className={cn(
                "text-micro font-medium tracking-wider uppercase",
                day.isToday
                  ? "text-primary"
                  : isWeekend(day.dateISO)
                    ? "text-muted-foreground/70"
                    : "text-muted-foreground",
              )}
            >
              {day.weekday}
            </p>
            <p className="mt-0.5 flex justify-center">
              <span
                className={cn(
                  "tabular-nums",
                  day.isToday
                    ? "bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-label font-medium"
                    : cn(
                        "text-title",
                        isWeekend(day.dateISO) && "text-muted-foreground",
                      ),
                )}
              >
                {dayNumber(day.dateISO)}
              </span>
            </p>
            <DayStrip
              blocks={blocksFor(day.dateISO)}
              isToday={day.dateISO === todayISO}
              index={index}
            />
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
              prayerBands={prayerBands[day.dateISO] ?? []}
              isToday={day.dateISO === todayISO}
              dayView={days.length === 1}
              drag={drag}
              setDrag={setDrag}
              commit={commit}
              onCreate={onCreate}
              onEdit={onEdit}
              onToggleDone={toggleDone}
              onToggleTask={toggleTask}
              onDropCue={dropCue}
              onDropItem={onDropItem}
              onDropOnBlock={onDropOnBlock}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const dayNumber = (dateISO: string): number =>
  new Date(`${dateISO}T00:00:00Z`).getUTCDate();

const isWeekend = (dateISO: string): boolean => {
  const day = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * The day as one thin bar, in the header of its column.
 *
 * The same glance as `/day`'s PlanStrip — "is this day already full?" — held
 * wide enough for a whole week to compare at once. The header row is the
 * legend: teal is work, slate is recovery, grey is buffer, a clay tick is a
 * switch with no room in it, and the running-blue line is now.
 *
 * Decorative on purpose: the grid underneath carries the real data, so the
 * strips are aria-hidden.
 */
function DayStrip({
  blocks,
  isToday,
  index,
}: {
  blocks: CalendarBlock[];
  isToday: boolean;
  /** Position in the week, for the stagger. */
  index: number;
}) {
  const span = STRIP_TO - STRIP_FROM;
  const position = (minute: number) =>
    `${((Math.min(Math.max(minute, STRIP_FROM), STRIP_TO) - STRIP_FROM) / span) * 100}%`;

  // A daydream is not time claimed, so it does not make a day look fuller.
  const committed = blocks.filter((block) => block.kind !== "DAYDREAM");

  const switches = transitionsForDay(
    committed.map((block) => ({
      id: block.id,
      title: block.title,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      cueForId: block.cueForId,
      hasCue: block.hasCue,
    })),
  ).filter((transition) => transition.kind !== "ok");

  return (
    <div
      aria-hidden
      className="animate-draw relative mx-1 mt-1.5 h-1.5 origin-left"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="bg-muted/60 absolute inset-0 rounded-full" />
      {mergedSegments(committed).map((segment) => (
        <div
          key={`${segment.startMinute}-${segment.endMinute}`}
          className={cn(
            "absolute inset-y-0 rounded-full",
            STRIP_FILL[segment.kind],
          )}
          style={{
            left: position(segment.startMinute),
            width: `calc(${position(segment.endMinute)} - ${position(segment.startMinute)})`,
          }}
        />
      ))}
      {switches.map((transition) => (
        <div
          key={`${transition.startMinute}-${transition.kind}`}
          className="bg-destructive/80 absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full"
          style={{ left: position(transition.startMinute) }}
        />
      ))}
      {isToday && (
        <NowPosition>
          {(nowMinute) =>
            nowMinute !== null &&
            nowMinute >= STRIP_FROM &&
            nowMinute <= STRIP_TO && (
              <div
                className="bg-running absolute inset-y-0 w-px"
                style={{ left: position(nowMinute) }}
              />
            )
          }
        </NowPosition>
      )}
    </div>
  );
}

/**
 * The day's busy time as segments, overlaps merged, coloured by the kind of
 * the block that opens each stretch. A minimap has no room for the difference
 * between "one 2h block" and "three that touch" — the grid shows that.
 */
function mergedSegments(blocks: CalendarBlock[]): {
  startMinute: number;
  endMinute: number;
  kind: CalendarBlock["kind"];
}[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  const segments: {
    startMinute: number;
    endMinute: number;
    kind: CalendarBlock["kind"];
  }[] = [];

  for (const block of sorted) {
    const last = segments[segments.length - 1];
    if (last && block.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, block.endMinute);
    } else {
      segments.push({
        startMinute: block.startMinute,
        endMinute: block.endMinute,
        kind: block.kind,
      });
    }
  }

  return segments;
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
  prayerBands,
  isToday,
  dayView,
  drag,
  setDrag,
  commit,
  onCreate,
  onEdit,
  onToggleDone,
  onToggleTask,
  onDropCue,
  onDropItem,
  onDropOnBlock,
}: {
  day: GridDay;
  blocks: CalendarBlock[];
  prayerBands: PrayerBand[];
  isToday: boolean;
  /** The grid is showing exactly one day — the invitation may speak. */
  dayView: boolean;
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
  onCreate: (
    dateISO: string,
    span: { startMinute: number; endMinute: number },
  ) => void;
  onEdit: (block: CalendarBlock) => void;
  onToggleDone: (block: CalendarBlock) => void;
  onToggleTask: (block: CalendarBlock, taskId: string) => void;
  onDropCue: (block: CalendarBlock) => void;
  onDropItem: (item: PlanDragItem, dateISO: string, startMinute: number) => void;
  onDropOnBlock: (item: PlanDragItem, block: CalendarBlock) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);

  // Where a dragged-in item would land, in minutes. Null when nothing of ours
  // is over this column.
  const [dropMinute, setDropMinute] = useState<number | null>(null);

  // Press-and-drag to create: the live span while the pointer is down on an
  // empty slot. Released without a drag, the slot just clicks.
  const [creating, setCreating] = useState<{
    startMinute: number;
    endMinute: number;
  } | null>(null);
  /** The click that follows a real drag must not also create. */
  const skipNextClickRef = useRef(false);

  /** Where in the day a pointer is, in minutes. */
  const minuteAt = (clientY: number): number => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return snap((clientY - rect.top) / MINUTE_PX);
  };

/**
 * Google's gesture: press an empty slot and drag down to claim exactly the
 * stretch you dragged, rather than asking for a length afterwards. A plain
 * press that never moves is a click, and clicks still open the editor with
 * the default length — nothing is lost by dragging.
 */
  const beginCreateDrag = (event: React.PointerEvent, minute: number) => {
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);

    let latest: { startMinute: number; endMinute: number } | null = null;
    setCreating({ startMinute: minute, endMinute: minute });

    const onMove = (moveEvent: PointerEvent) => {
      const current = minuteAt(moveEvent.clientY);
      latest = {
        startMinute: Math.min(minute, current),
        endMinute: Math.max(minute, current),
      };
      setCreating(latest);
    };

    const onUp = () => {
      element.releasePointerCapture(event.pointerId);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      setCreating(null);
      if (
        latest &&
        latest.endMinute - latest.startMinute >= MIN_BLOCK_MINUTES
      ) {
        // The trailing click would otherwise create a second, 1-hour block.
        skipNextClickRef.current = true;
        onCreate(day.dateISO, latest);
      }
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
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

  // The dragged block's live position, so everything downstream describes the
  // day as it is being arranged rather than as it was a moment ago.
  const positioned = blocks.map((block) =>
    drag && drag.id === block.id
      ? { ...block, startMinute: drag.startMinute, endMinute: drag.endMinute }
      : block,
  );

  const laid = layoutColumns(positioned);

  /**
   * The block the pointer is currently over, if any.
   *
   * A drop on empty grid makes a new block; a drop *on* a block adds to it.
   * Without this the two gestures are indistinguishable, and the only way to
   * put a third task into a two-hour stretch would be to open the editor and
   * hunt for it — which is exactly the friction the grouping is supposed to
   * remove.
   */
  const dropBlock =
    dropMinute === null
      ? null
      : (positioned.find(
          (block) =>
            dropMinute >= block.startMinute && dropMinute < block.endMinute,
        ) ?? null);

  // Recomputed mid-drag on purpose: watching the gap close as you drag is the
  // point. Told after the fact, you have already made the plan that fails.
  const transitions = transitionsForDay(
    positioned.map((block) => ({
      id: block.id,
      title: block.title,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      cueForId: block.cueForId,
      hasCue: block.hasCue,
    })),
  );

  return (
    <div
      ref={columnRef}
      className={cn(
        "border-border/60 relative border-l",
        day.isToday && "bg-accent/30 ring-primary/15 ring-1 ring-inset",
      )}
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
        const target = dropBlock;
        setDropMinute(null);
        if (!item) return;
        event.preventDefault();
        if (target) {
          onDropOnBlock(item, target);
          return;
        }
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

      {/* The hours you don't plan in, dimmed. The grid runs the full 24 but the
          day's waking window (07–22, the same one the header strips measure
          against) is where a plan can actually live — shading the rest makes
          the usable day visible without a single word. Opaque enough to read,
          quiet enough to ignore; a hairline marks each edge. */}
      <div
        aria-hidden
        className="bg-background/70 pointer-events-none absolute inset-x-0 top-0 border-border/40 border-b"
        style={{ height: STRIP_FROM * MINUTE_PX }}
      />
      <div
        aria-hidden
        className="bg-background/70 pointer-events-none absolute inset-x-0 border-border/40 border-t"
        style={{
          top: STRIP_TO * MINUTE_PX,
          height: (MINUTES_PER_DAY - STRIP_TO) * MINUTE_PX,
        }}
      />

      {/* Click targets, one per quarter hour. A div with an onClick would
          swallow block clicks; these sit underneath, at z-0. The dashed inset
          outline on hover is the affordance — a clickable slot announces
          itself, so no instructions are needed. Pressing and dragging claims
          the dragged stretch; pressing without moving opens the editor with
          the default length. */}
      {Array.from({ length: MINUTES_PER_DAY / SNAP_MINUTES }, (_, slot) => (
        <button
          key={slot}
          type="button"
          aria-label={`Block out ${formatMinuteOfDay(slot * SNAP_MINUTES)} on ${day.label}`}
          onPointerDown={(event) => beginCreateDrag(event, slot * SNAP_MINUTES)}
          onClick={() => {
            if (skipNextClickRef.current) {
              skipNextClickRef.current = false;
              return;
            }
            // Keyboard and plain mouse presses both land here: create with the
            // default length at this slot.
            onCreate(day.dateISO, spanOfLength(slot * SNAP_MINUTES, PLAN_DEFAULT_MINUTES));
          }}
          className="hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:ring-ring after:border-primary/30 absolute inset-x-0 after:absolute after:inset-x-1 after:inset-y-0.5 after:rounded-md after:border after:border-dashed after:opacity-0 after:transition-opacity hover:after:opacity-100 focus-visible:after:opacity-100 focus-visible:ring-1 focus-visible:outline-none"
          style={{ top: slot * SNAP_MINUTES * MINUTE_PX, height: SNAP_MINUTES * MINUTE_PX }}
        />
      ))}

      {/* The live span while pressing-and-dragging to create. */}
      {creating && (
        <div
          className="border-primary bg-primary/15 pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-md border border-dashed px-2 py-1"
          style={{
            top: creating.startMinute * MINUTE_PX,
            height: Math.max(
              18,
              (creating.endMinute - creating.startMinute) * MINUTE_PX - 2,
            ),
          }}
        >
          <p className="truncate text-label leading-4 font-medium">New block</p>
          <p className="text-muted-foreground text-micro tabular-nums">
            {formatMinuteOfDay(creating.startMinute)} –{" "}
            {formatMinuteOfDay(creating.endMinute)}
          </p>
        </div>
      )}

      {isToday && (
        <NowPosition>
          {(nowMinute) =>
            nowMinute !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20"
                style={{ top: nowMinute * MINUTE_PX }}
              >
                <div className="bg-running relative h-px">
                  <span className="bg-running absolute -top-1 -left-1 size-2 rounded-full" />
                  {/* The one number the line could never speak: what time it
                      actually is. Riding the line, in the line's own colours —
                      it is a clock, which is what the reservation permits. */}
                  <span className="bg-running text-running-foreground absolute -top-2.5 right-1 rounded-full px-1.5 py-0.5 font-mono text-[0.625rem] leading-none tabular-nums">
                    {formatMinuteOfDay(nowMinute)}
                  </span>
                </div>
              </div>
            )
          }
        </NowPosition>
      )}

      {/* The empty day speaks once, in the grid, where the hands go. The
          header sentence names the fact; this names the gesture. Drawn in the
          middle of the waking window and pointer-safe, so every slot under it
          stays clickable. */}
      {dayView && positioned.length === 0 && (
        <div
          aria-hidden
          className="border-border pointer-events-none absolute inset-x-4 rounded-xl border border-dashed px-6 py-5 text-center"
          style={{ top: 12 * 60 * MINUTE_PX }}
        >
          <p className="text-label text-muted-foreground">
            Press and drag anywhere to claim a stretch of the day.
          </p>
          <p className="text-muted-foreground/70 mt-1 text-micro">
            Or pull a habit or task in from the panel.
          </p>
        </div>
      )}

      {/* Where it would land, at the length it would be. A drop indicator that
          only marks the start minute leaves you guessing whether a 90-minute
          task clears the thing below it — which is the actual question. */}
      {dropMinute !== null &&
        dropBlock === null &&
        (() => {
          const minutes = activePlanItem()?.minutes ?? PLAN_DEFAULT_MINUTES;
          return (
            <DropPreview
              startMinute={dropMinute}
              minutes={minutes}
              title={activePlanItem()?.title ?? ""}
              // Reported before the drop, not after. Told afterwards you have
              // already made the plan; told now it costs one nudge. It never
              // refuses the placement — "there is no room for this" is a real
              // answer here, and a calendar that silently declines is one you
              // stop trusting.
              crowded={abutsNeighbour(
                { startMinute: dropMinute, endMinute: dropMinute + minutes },
                positioned,
              )}
            />
          );
        })()}

      {/* Under the blocks in z-order: this describes the space between them and
          must never sit on top of something you can drag. */}
      {transitions.map((transition) => (
        <TransitionStrip
          key={`${transition.startMinute}-${transition.endMinute}`}
          transition={transition}
          minutePx={MINUTE_PX}
        />
      ))}

      {/* The prayer windows of the day, behind the plan. Painted before the
          blocks so a block always wins the z-stack, and pointer-events-none so
          the empty slots underneath stay clickable — the check button is the
          only interactive thing here. */}
      <PrayerBands bands={prayerBands} isToday={isToday} minutePx={MINUTE_PX} />

      {laid.map(({ block, column, columns }) => (
        <BlockChip
          key={block.id}
          block={block}
          column={column}
          columns={columns}
          dragging={drag?.id === block.id}
          /** The drop would land *in* this block rather than beside it. */
          receiving={dropBlock?.id === block.id}
          onPointerDown={(event, mode) => beginDrag(event, block, mode)}
          onToggleDone={() => onToggleDone(block)}
          onToggleTask={(taskId) => onToggleTask(block, taskId)}
          onDropCue={() => onDropCue(block)}
        />
      ))}
    </div>
  );
}

function DropPreview({
  startMinute,
  minutes,
  title,
  crowded,
}: {
  startMinute: number;
  minutes: number;
  title: string;
  /** Landing here would leave no room to switch into or out of it. */
  crowded: boolean;
}) {
  return (
    <div
      className={cn(
        "text-foreground pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-md border border-dashed px-2 py-1",
        crowded
          ? "border-destructive bg-destructive/15"
          : "border-primary bg-primary/15",
      )}
      style={{
        top: startMinute * MINUTE_PX,
        height: Math.max(18, minutes * MINUTE_PX - 2),
      }}
    >
      <p className="truncate text-label leading-4 font-medium">{title}</p>
      <p
        className={cn(
          "text-micro tabular-nums",
          crowded ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {crowded
          ? "no room to switch"
          : `${formatMinuteOfDay(startMinute)} – ${formatMinuteOfDay(
              startMinute + minutes,
            )}`}
      </p>
    </div>
  );
}

/**
 * Colour is by *kind*, never by state — unless the block is tied to a task
 * that wears its own colour, in which case the task's identity wins and the
 * kind's tint only survives for untethered blocks.
 *
 * Amber stays reserved for a clock that is actually running — the now-line is
 * the only amber on this screen, and a planned block borrowing it would make
 * the whole day look like it was in progress.
 */
const KIND_STYLES = {
  WORK: "bg-primary/12 border-primary/45 text-foreground",
  RECOVERY: "bg-rest-muted border-rest/45 text-foreground",
  BUFFER: "bg-muted border-border text-muted-foreground border-dashed",
  DAYDREAM:
    "bg-violet-400/10 border-violet-400/40 text-muted-foreground border-dashed",
} as const;

/**
 * The play button on a task, wherever it sits — the block's heading row or one
 * of the lines in its list.
 *
 * It opens the timer *on that task*, which is the whole reason a block carries
 * a task at all. The estimate offered is the block's own length: the time you
 * claimed is the time you have, and it is the same number for every task in a
 * group because a group is one stretch, not three budgets.
 *
 * Idle at half strength rather than hidden. A group's whole point is that it is
 * a set of things you are going to *do*, and an affordance that exists only on
 * hover does not exist on a touch screen, in a screenshot, or to anyone
 * scanning the week for where to start. It now answers to its own row's hover
 * instead of the whole chip's, so three rows don't light up at once.
 */
function TaskTimerLink({
  task,
  minutes,
  done,
}: {
  task: BlockTask;
  minutes: number;
  done: boolean;
}) {
  if (done) return null;

  return (
    <Link
      href={buildTimerHref({
        id: task.id,
        estimatedSeconds: minutes * 60,
        defaultMode: toWorkMode(task.defaultMode),
        plannedIntervals: task.plannedIntervals,
      })}
      aria-label={`Start a timer for ${task.title}`}
      onPointerDown={(event) => event.stopPropagation()}
      className="text-muted-foreground/45 group-hover/row:text-primary focus-visible:text-primary shrink-0 transition-colors group-hover/row:opacity-100 focus-visible:opacity-100"
    >
      <Play className="size-3" aria-hidden />
    </Link>
  );
}

/**
 * One line inside a block: the mark, the name, the way in.
 *
 * The mark is a **square**, and that is exactly why the block's own tick can
 * stay a circle. Three hollow circles stacked read as a set of radio buttons —
 * *choose one* — which is the opposite of what a block holding three things
 * means. A square says "any number of these"; the circle a level up says "all
 * of it".
 *
 * Its outline wears the task's own hue, because a task's colour is its identity
 * everywhere else in the app and inside a shared block this is the only place
 * left to carry it. Done fills it with the primary, matching every other
 * finished mark on the calendar: the hue is identity, the teal is state, and
 * the two never have to compete.
 *
 * The row is `flex-1` up to a cap, so a group's lines spread down the height it
 * claims instead of huddling at the top of it. Vertical space *is* time on this
 * grid, and a two-hour block with three things in it should not look like a
 * forty-minute one with three things in it.
 */
function BlockTaskRow({
  task,
  minutes,
  onToggle,
}: {
  task: BlockTask;
  minutes: number;
  onToggle: () => void;
}) {
  const done = task.doneAt !== null;

  return (
    <li
      className="group/row hover:bg-foreground/[0.05] -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 transition-colors"
      style={{ minHeight: TASK_LINE_PX, maxHeight: TASK_ROW_MAX_PX }}
    >
      <button
        type="button"
        aria-label={
          done
            ? `Untick ${task.title} in this block`
            : `Tick ${task.title} off in this block`
        }
        title="Done in this block — the task itself stays open"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          "grid size-3 shrink-0 place-items-center rounded-[3px] border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground animate-pop"
            : "hover:border-current",
        )}
        style={
          done || !isCalendarColor(task.color)
            ? undefined
            : calendarInkStyle(task.color)
        }
      >
        <Check
          className={cn(
            "size-2 transition-opacity",
            done ? "opacity-100" : "opacity-0 group-hover/row:opacity-45",
          )}
          strokeWidth={3}
          aria-hidden
        />
      </button>

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-label",
          done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </span>

      <TaskTimerLink task={task} minutes={minutes} done={done} />
    </li>
  );
}

function BlockChip({
  block,
  column,
  columns,
  dragging,
  receiving,
  onPointerDown,
  onToggleDone,
  onToggleTask,
  onDropCue,
}: {
  block: CalendarBlock;
  column: number;
  columns: number;
  dragging: boolean;
  /** A dragged task is hovering this block: dropping adds it here. */
  receiving: boolean;
  onPointerDown: (event: React.PointerEvent, mode: "move" | "resize") => void;
  onToggleDone: () => void;
  onToggleTask: (taskId: string) => void;
  onDropCue: () => void;
}) {
  const minutes = spanMinutes(block);
  const compact = minutes < COMPACT_MINUTES;
  /** Shorter than a heading plus its own padding: air is the first thing to go. */
  const tight = minutes < TIGHT_MINUTES;
  const done = block.completedAt !== null;
  /** This block is the cue in front of another one. */
  const isCue = block.cueForId !== null;

  /**
   * One task reads exactly as it always did — the block *is* that task, so its
   * title is the block's title and there is no list to draw. Several turn the
   * body into a short checklist.
   */
  const multi = block.tasks.length > 1;
  const label = blockLabel(block);
  const named = block.title.trim().length > 0;
  const progress = blockProgressParts(block);

  /**
   * The heading.
   *
   * An unnamed group is **called by its progress** — "0 of 3" — which is the
   * one fact a group has that a single-task block doesn't, and the only one
   * worth printing where a title would go. "3 tasks" said the same thing twice:
   * once as a heading, once as the three lines directly beneath it. The
   * fraction says it once, and says something the list cannot.
   *
   * A named group keeps its name; every block that was ever titled reads
   * exactly as it did before.
   */
  const heading = named
    ? block.title
    : multi
      ? null
      : (block.tasks[0]?.title ?? "Untitled block");

  /** A name and a fraction are two facts, so a named group shows both. */
  const showProgress = multi && named && progress !== null;

  /**
   * The task's hue, when there is exactly one task to inherit it from. A block
   * holding three stays the kind's colour: it is a container, not any one of
   * the things inside it, and picking a winner would be inventing a ranking the
   * product doesn't have. Each line carries its own hue on its mark instead.
   *
   * A cue stays quiet — it is part of something else, not a thing with an
   * identity of its own.
   */
  const tint =
    !isCue && block.tasks.length === 1 && isCalendarColor(block.tasks[0].color)
      ? calendarChipStyle(block.tasks[0].color)
      : null;

  // How much of the body fits at this height, decided in one place. Drawn from
  // the block's real pixel height, because the grid's scale is the only thing
  // that knows what fits — a 40-minute block and a 2-hour one are the same
  // component at different heights.
  const heightPx = Math.max(BLOCK_MIN_HEIGHT_PX, minutes * MINUTE_PX - 2);
  const { fit, showMeta } = layoutBlockBody({
    heightPx,
    // A single-task block draws no list, so it must not make room for one.
    taskCount: multi ? block.tasks.length : 0,
    isCue,
    compact,
    tight,
  });
  const showList = multi && fit.showList;
  const visible = block.tasks.slice(0, fit.visible);

  const width = `calc(${100 / columns}% - 4px)`;
  const left = `calc(${(column * 100) / columns}% + 2px)`;

  return (
    <div
      className={cn(
        "group absolute z-10 flex flex-col overflow-hidden rounded-md border px-2 select-none",
        tight ? "py-0" : "py-1",
        "transition-shadow duration-150 hover:shadow-sm",
        // A task-coloured block sheds the kind's tint and the buffer's
        // dashed "empty on purpose" reading — it has a thing behind it now.
        tint ? "text-foreground" : KIND_STYLES[block.kind],
        done && "opacity-55",
        // A cue is quieter than what it triggers, and only rounded at the top,
        // so the pair reads as one object with a seam rather than two blocks
        // that happen to touch. It is still a real block underneath — the styling
        // says "part of that", not "not really here".
        isCue &&
          "rounded-b-none border-b-transparent border-dashed bg-transparent",
        dragging && "z-30 cursor-grabbing shadow-md",
        !dragging && "cursor-grab",
        receiving && "ring-primary/70 z-20 ring-2",
      )}
      style={{
        top: block.startMinute * MINUTE_PX,
        height: heightPx,
        width,
        left,
        ...tint,
      }}
      onPointerDown={(event) => onPointerDown(event, "move")}
    >
      {isCue ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <CornerDownRight
            className="text-muted-foreground size-3 shrink-0"
            aria-hidden
          />
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-micro leading-4 normal-case tracking-normal">
            {label}
          </p>
          <button
            type="button"
            aria-label={`Skip ${label} today`}
            title="Not today"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDropCue();
            }}
            className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              // `group/row` as well as the chip's own `group`: a single-task
              // block's play button lives here rather than on a list row, and
              // without this it would never brighten.
              "group/row flex shrink-0 min-w-0 items-start gap-1.5",
              compact && "items-center",
            )}
          >
            <button
              type="button"
              aria-label={done ? `Untick ${label}` : `Tick off ${label}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onToggleDone();
              }}
              className={cn(
                "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors",
                compact && "mt-0",
                done
                  ? "border-primary bg-primary text-primary-foreground animate-pop"
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

            {/* An unnamed group's heading *is* its progress, set in the mono
                face this app keeps for numerals. Two reasons it reads as a
                heading rather than as a fourth row: it is mono where the rows
                are the body face, and the list hangs off a rule beneath it. */}
            {heading === null && progress ? (
              // No colour on the parent, deliberately: the number inherits the
              // block's own ink and only the tail is dimmed, so nothing depends
              // on which of two colour utilities Tailwind happens to emit last.
              <p className="min-w-0 flex-1 truncate font-mono text-label leading-4 tracking-tight">
                <span className="font-medium tabular-nums">{progress.done}</span>{" "}
                <span className="text-muted-foreground tabular-nums">
                  of {progress.total}
                </span>
              </p>
            ) : (
              <p
                className={cn(
                  "min-w-0 flex-1 text-label leading-4 font-medium",
                  // A tall single-task block has room for two lines, and "Write…"
                  // in a 90-minute box throws away the space that makes a week
                  // view readable at a glance. A block with a list under it keeps
                  // to one line, because the list is the thing worth reading.
                  compact || multi ? "truncate" : "line-clamp-2",
                  done && "line-through",
                  block.kind === "DAYDREAM" && "italic",
                )}
              >
                {heading}
              </p>
            )}

            {/* A name and a fraction are different facts; a named group shows
                both, and the fraction is the one that moves, so it is the one
                set loudest. */}
            {showProgress && progress && (
              <span className="shrink-0 font-mono text-micro tabular-nums">
                <span className="font-medium">{progress.done}</span>
                <span className="text-muted-foreground">
                  /{progress.total}
                </span>
              </span>
            )}

            {/* The block's own task. A group's play buttons live on its lines. */}
            {!multi && block.tasks[0] && (
              <TaskTimerLink
                task={block.tasks[0]}
                minutes={minutes}
                done={done}
              />
            )}
          </div>

          {/* The group, as a checklist. No order between the lines beyond the
              order they were added — nothing here is a sequence.

              The rule down the left is what stops the heading reading as the
              first item in its own list: the heading sits on the block's edge,
              the contents are visibly hung inside it. It is the same hairline
              the calendar already uses for the space between two blocks, doing
              the one other job it is good at. */}
          {showList && (
            <ul
              className="border-current/20 flex min-h-0 flex-1 flex-col border-l pl-2.5"
              style={{ marginTop: LIST_GAP_PX }}
            >
              {visible.map((task) => (
                <BlockTaskRow
                  key={task.id}
                  task={task}
                  minutes={minutes}
                  onToggle={() => onToggleTask(task.id)}
                />
              ))}

              {fit.hidden > 0 && (
                // Indented past the mark column, so it lines up with the task
                // names above it rather than reading as another mark.
                <li
                  className="text-muted-foreground flex shrink-0 items-center pl-5 font-mono text-micro"
                  style={{ minHeight: TASK_LINE_PX }}
                >
                  <span className="tabular-nums">+{fit.hidden} more</span>
                </li>
              )}
            </ul>
          )}
        </>
      )}

      {/* The footer. `mt-auto` pins it to the block's bottom edge, so the space
          a group doesn't use collects *above* it rather than pushing the stamp
          up under the last task — where it read as one more thing to do.

          The slack is not a bug to hide. Vertical space is time on this grid,
          and a two-hour block holding two things genuinely has room left in it;
          the pinned stamp is what turns that from an accident into a fact. */}
      {showMeta && (
        <p className="text-muted-foreground mt-auto shrink-0 pt-0.5 text-micro tabular-nums">
          {formatMinuteOfDay(block.startMinute)} · {formatSpanLength(block)}
        </p>
      )}

      {/* Resize handle. Only appears on hover, so it never competes with the
          block's own content for a 20px-tall block.

          Not offered on a cue: its bottom edge is the habit's top edge, and
          dragging it would either overlap what it cues or open a gap — both of
          which break the adjacency that makes it a cue. Change the length on the
          habit instead. */}
      {!isCue && (
        <button
          type="button"
          aria-label={`Change the length of ${label}`}
          onPointerDown={(event) => onPointerDown(event, "resize")}
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 focus-visible:opacity-100"
        >
          <GripHorizontal className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
