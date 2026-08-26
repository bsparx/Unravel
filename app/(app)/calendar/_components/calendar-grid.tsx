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
  clampSpan,
  formatMinuteOfDay,
  formatSpanLength,
  layoutColumns,
  MIN_BLOCK_MINUTES,
  MINUTES_PER_DAY,
  PLAN_DEFAULT_MINUTES,
  snap,
  SNAP_MINUTES,
  spanMinutes,
  spanOfLength,
} from "@/lib/block-math";
import {
  calendarChipStyle,
  isCalendarColor,
} from "@/lib/calendar-colors";
import {
  activePlanItem,
  isPlanItemDrag,
  readPlanItem,
  type PlanDragItem,
} from "@/lib/plan-drag";
import type { CalendarBlock } from "@/lib/time-blocks";
import type { PrayerBand } from "@/lib/prayers";
import { buildTimerHref } from "@/lib/timer-url";
import { toWorkMode } from "@/lib/timer-math";
import { abutsNeighbour, transitionsForDay } from "@/lib/transitions";
import { cn } from "@/lib/utils";

import { deleteBlock, moveBlock, toggleBlockDone } from "../actions";
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
  | { kind: "remove"; id: string };

export function CalendarGrid({
  days,
  blocks,
  prayerBands,
  todayISO,
  onCreate,
  onEdit,
  onDropItem,
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
      if (block.id === patch.id) {
        return {
          ...block,
          dateISO: patch.dateISO,
          startMinute: patch.startMinute,
          endMinute: patch.endMinute,
        };
      }

      // A cue keeps its place at the front of the block it cues. `moveBlock`
      // does the same on the server; doing it here too is what stops the cue
      // visibly lagging a frame behind the thing it's glued to.
      if (block.cueForId === patch.id) {
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
      const formData = new FormData();
      formData.set("id", block.id);
      formData.set("done", String(block.completedAt === null));
      await toggleBlockDone(formData);
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
              drag={drag}
              setDrag={setDrag}
              commit={commit}
              onCreate={onCreate}
              onEdit={onEdit}
              onToggleDone={toggleDone}
              onDropCue={dropCue}
              onDropItem={onDropItem}
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
  drag,
  setDrag,
  commit,
  onCreate,
  onEdit,
  onToggleDone,
  onDropCue,
  onDropItem,
}: {
  day: GridDay;
  blocks: CalendarBlock[];
  prayerBands: PrayerBand[];
  isToday: boolean;
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
  onDropCue: (block: CalendarBlock) => void;
  onDropItem: (item: PlanDragItem, dateISO: string, startMinute: number) => void;
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
                </div>
              </div>
            )
          }
        </NowPosition>
      )}

      {/* Where it would land, at the length it would be. A drop indicator that
          only marks the start minute leaves you guessing whether a 90-minute
          task clears the thing below it — which is the actual question. */}
      {dropMinute !== null &&
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
          onPointerDown={(event, mode) => beginDrag(event, block, mode)}
          onToggleDone={() => onToggleDone(block)}
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

function BlockChip({
  block,
  column,
  columns,
  dragging,
  onPointerDown,
  onToggleDone,
  onDropCue,
}: {
  block: CalendarBlock;
  column: number;
  columns: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent, mode: "move" | "resize") => void;
  onToggleDone: () => void;
  onDropCue: () => void;
}) {
  const minutes = spanMinutes(block);
  const compact = minutes < COMPACT_MINUTES;
  const done = block.completedAt !== null;
  /** This block is the cue in front of another one. */
  const isCue = block.cueForId !== null;
  /**
   * The task's hue, when there is one. A cue stays quiet — it is part of
   * something else, not a thing with an identity of its own.
   */
  const tint =
    !isCue && block.task && isCalendarColor(block.task.color)
      ? calendarChipStyle(block.task.color)
      : null;

  const width = `calc(${100 / columns}% - 4px)`;
  const left = `calc(${(column * 100) / columns}% + 2px)`;

  return (
    <div
      className={cn(
        "group absolute z-10 overflow-hidden rounded-md border px-2 py-1 select-none",
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
      )}
      style={{
        top: block.startMinute * MINUTE_PX,
        height: Math.max(18, minutes * MINUTE_PX - 2),
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
            {block.title}
          </p>
          <button
            type="button"
            aria-label={`Skip ${block.title} today`}
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
        <div
          className={cn(
            "flex min-w-0 items-start gap-1.5",
            compact && "items-center",
          )}
        >
          <button
            type="button"
            aria-label={
              done ? `Untick ${block.title}` : `Tick off ${block.title}`
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDone();
            }}
            className={cn(
              "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors",
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

          <p
            className={cn(
              "min-w-0 flex-1 text-label leading-4 font-medium",
              // A tall block has the room for two lines, and "Write…" in a
              // 90-minute box is throwing away the space that makes a week view
              // readable at a glance.
              compact ? "truncate" : "line-clamp-2",
              done && "line-through",
              block.kind === "DAYDREAM" && "italic",
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
      )}

      {!compact && !isCue && (
        <p className="text-muted-foreground mt-0.5 text-micro tabular-nums">
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
          aria-label={`Change the length of ${block.title}`}
          onPointerDown={(event) => onPointerDown(event, "resize")}
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-60 focus-visible:opacity-100"
        >
          <GripHorizontal className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
