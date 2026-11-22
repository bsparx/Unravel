"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlignLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Cloud,
  Flame,
  Heart,
  Link2,
  ListChecks,
  Pause,
  Plus,
  Search,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog as DialogPrimitive,
  Popover as PopoverPrimitive,
} from "radix-ui";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  CALENDAR_COLOR_NAMES,
  CALENDAR_COLORS,
  calendarDotStyle,
  isCalendarColor,
  type CalendarColor,
} from "@/lib/calendar-colors";
import {
  clampSpan,
  formatMinuteLength,
  formatMinuteOfDay,
  MIN_BLOCK_MINUTES,
  MINUTES_PER_DAY,
  parseMinuteOfDay,
  spanOfLength,
} from "@/lib/block-math";
import { BEAT_MINUTES, beatCount } from "@/lib/block-beats";
import { formatDate, parseLocalDate, WEEKDAYS } from "@/lib/dates";
import { idleState, MAX_BLOCK_TASKS } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createBlock, deleteBlock, updateBlock } from "../actions";
import { updateTaskColor } from "@/app/(app)/tasks/actions";
import {
  computeWidgetPosition,
  endTimeOptions,
  formatEndMinuteLabel,
  isoToPickerDate,
  pickerDateToISO,
  startTimeOptions,
  type AnchorRect,
  type WidgetPosition,
} from "../_lib/block-widget";
import type { DraftPreview } from "./calendar-grid";

export type BlockTaskDraft = { id: string; title: string; color: string };

export type BlockDraft = {
  id?: string;
  dateISO: string;
  startMinute: number;
  endMinute: number;
  title: string;
  notes: string;
  /**
   * The tasks this stretch of time is for. A list, in no promised order — the
   * one invariant is that a block is *for* these, and two hours is often three
   * things rather than one.
   */
  taskIds: string[];
  /**
   * The block's own tasks, as they already are.
   *
   * They have to travel with the draft because the panel beside the grid only
   * lists what is *not* on the day yet — a saved block's tasks are excluded
   * from it by construction, and an editor that resolves its chips from the
   * panel alone would silently drop every task the moment you opened it.
   */
  tasks: BlockTaskDraft[];
  /** The first linked task's calendar hue, so the picker opens on it. */
  taskColor: CalendarColor | null;
  kind: "WORK" | "RECOVERY" | "BUFFER" | "DAYDREAM";
  /** This block already has a cue in front of it, so don't offer to add one. */
  hasCue: boolean;
  /** Interval mode: one thing every this many minutes. Null is off. */
  beatMinutes: number | null;
};

const KINDS: {
  value: BlockDraft["kind"];
  label: string;
  hint: string;
  icon: typeof Flame;
}[] = [
  {
    value: "WORK",
    label: "Work",
    hint: "Something you're going to do.",
    icon: Flame,
  },
  {
    value: "RECOVERY",
    label: "Recovery",
    hint: "Deliberate rest. It counts.",
    icon: Heart,
  },
  {
    value: "BUFFER",
    label: "Buffer",
    hint: "Left empty on purpose.",
    icon: Pause,
  },
  {
    value: "DAYDREAM",
    label: "Break",
    hint: "A pause that doesn't count toward anything.",
    icon: Cloud,
  },
];

/** Quick lengths, in minutes. Long enough a list, short enough to scan. */
const LENGTHS = [15, 25, 45, 60, 90];

const PACES: { value: number | null; label: string }[] = [
  { value: null, label: "Off" },
  ...BEAT_MINUTES.map((minutes) => ({ value: minutes, label: `${minutes}m` })),
];

const CARD_WIDTH_DESKTOP = 432;
const CARD_ESTIMATED_HEIGHT = 480;
const DESKTOP_BREAKPOINT = 640;

function formatShortDateLabel(dateISO: string): string {
  const date = parseLocalDate(dateISO);
  if (!date) return dateISO;
  return `${WEEKDAYS[date.getUTCDay()].short}, ${formatDate(date)}`;
}

/**
 * Always mounted with a `key` derived from the draft — see the call site.
 *
 * Google Calendar–style floating widget anchored beside the clicked timeslot or
 * block on desktop, and a clean bottom sheet on phones.
 */
export function BlockDialog({
  draft,
  anchorRect = null,
  tasks,
  onPreviewChange,
  onClose,
}: {
  draft: BlockDraft;
  anchorRect?: AnchorRect | null;
  tasks: { id: string; title: string; cueTitle: string | null; color: string }[];
  onPreviewChange?: (preview: DraftPreview | null) => void;
  onClose: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateBlock : createBlock,
    idleState,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);

  const [dateISO, setDateISO] = useState(draft.dateISO);
  const [start, setStart] = useState(draft.startMinute);
  const [end, setEnd] = useState(draft.endMinute);
  const [kind, setKind] = useState<BlockDraft["kind"]>(draft.kind);
  const [title, setTitle] = useState(draft.title);
  const [taskIds, setTaskIds] = useState<string[]>(draft.taskIds);
  const [taskColor, setTaskColor] = useState<CalendarColor>(
    draft.taskColor ?? "teal",
  );
  const [includeCue, setIncludeCue] = useState(true);
  const [beatMinutes, setBeatMinutes] = useState<number | null>(
    draft.beatMinutes,
  );

  const [dateOpen, setDateOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [colorOpen, setColorOpen] = useState(false);

  // Floating position on desktop (`>= 640px`). Computed synchronously on mount
  // so the first frame already sits beside the clicked slot without flashing.
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerWidth >= DESKTOP_BREAKPOINT
      : true,
  );
  const [position, setPosition] = useState<WidgetPosition>(() =>
    computeWidgetPosition({
      anchor: anchorRect,
      card: { width: CARD_WIDTH_DESKTOP, height: CARD_ESTIMATED_HEIGHT },
      viewport:
        typeof window !== "undefined"
          ? { width: window.innerWidth, height: window.innerHeight }
          : { width: 1280, height: 800 },
    }),
  );

  const recomputePosition = useCallback(() => {
    const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    setIsDesktop(desktop);
    if (!desktop) return;

    const rect = contentEl?.getBoundingClientRect();
    const width = rect && rect.width > 0 ? rect.width : CARD_WIDTH_DESKTOP;
    const height = rect && rect.height > 0 ? rect.height : CARD_ESTIMATED_HEIGHT;

    setPosition(
      computeWidgetPosition({
        anchor: anchorRect,
        card: { width, height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
  }, [anchorRect, contentEl]);

  useEffect(() => {
    window.addEventListener("resize", recomputePosition);

    let observer: ResizeObserver | null = null;
    if (contentEl && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(recomputePosition);
      observer.observe(contentEl);
    }

    return () => {
      window.removeEventListener("resize", recomputePosition);
      observer?.disconnect();
    };
  }, [recomputePosition, contentEl]);

  const duration = Math.max(0, end - start);
  const paced = kind === "WORK" && beatMinutes !== null;
  const intervals =
    paced && end > start
      ? beatCount({ startMinute: start, endMinute: end }, beatMinutes)
      : 0;

  const linked = useMemo(
    () =>
      taskIds
        .map(
          (id) =>
            draft.tasks.find((task) => task.id === id) ??
            tasks.find((task) => task.id === id) ??
            null,
        )
        .filter((task): task is BlockTaskDraft => task !== null),
    [taskIds, draft.tasks, tasks],
  );

  const availableTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return tasks.filter(
      (task) =>
        !taskIds.includes(task.id) &&
        (q.length === 0 || task.title.toLowerCase().includes(q)),
    );
  }, [tasks, taskIds, taskQuery]);

  // Only one block can be one habit's precursor, so only the first task that
  // has a cue can bring it. See `plannedCueForAny`.
  const cueTitle = draft.hasCue
    ? null
    : (tasks.find((task) => taskIds.includes(task.id) && task.cueTitle)
        ?.cueTitle ?? null);

  const soleTask = taskIds.length === 1 ? linked[0] : null;
  const namedOrStaffed = title.trim().length > 0 || taskIds.length > 0;

  // Live accent colour driving the top edge bar, status dot, and focus underline.
  const accentColor = useMemo(() => {
    if (kind === "RECOVERY") return "var(--rest)";
    if (kind === "BUFFER") return "var(--muted-foreground)";
    if (kind === "DAYDREAM") return "#a78bfa";
    if (soleTask && isCalendarColor(taskColor)) {
      return CALENDAR_COLORS[taskColor];
    }
    return "var(--primary)";
  }, [kind, soleTask, taskColor]);

  // Sync live ghost preview block on the grid while creating a new block.
  useEffect(() => {
    if (editing || !onPreviewChange) return;
    onPreviewChange({
      dateISO,
      startMinute: start,
      endMinute: end,
      title: title.trim() ? title : (soleTask?.title ?? ""),
      kind,
      taskColor: soleTask && isCalendarColor(taskColor) ? taskColor : null,
    });
  }, [
    editing,
    onPreviewChange,
    dateISO,
    start,
    end,
    title,
    soleTask,
    kind,
    taskColor,
  ]);

  const addTask = (id: string) => {
    const picked = tasks.find((task) => task.id === id);
    setTaskIds((current) => {
      if (current.includes(id) || current.length >= MAX_BLOCK_TASKS) {
        return current;
      }
      if (current.length === 0 && picked && isCalendarColor(picked.color)) {
        setTaskColor(picked.color);
      }
      return [...current, id];
    });
    setTaskQuery("");
    setTaskPickerOpen(false);
  };

  const removeTask = (id: string) => {
    setTaskIds((current) => {
      const next = current.filter((taskId) => taskId !== id);
      if (next.length === 1) {
        const remaining =
          draft.tasks.find((task) => task.id === next[0]) ??
          tasks.find((task) => task.id === next[0]);
        if (remaining && isCalendarColor(remaining.color)) {
          setTaskColor(remaining.color);
        }
      }
      return next;
    });
  };

  /** Re-colour the linked task — the block re-tints with it on revalidate. */
  const pickTaskColor = (color: CalendarColor) => {
    setTaskColor(color);
    setColorOpen(false);
    if (!soleTask) return;
    const formData = new FormData();
    formData.set("taskId", soleTask.id);
    formData.set("color", color);
    updateTaskColor(formData);
    toast.success("Colour updated.");
  };

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      onClose();
    } else if (state.status === "error" && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onClose]);

  const error = (field: string) =>
    state.status === "error" ? state.fieldErrors?.[field] : undefined;

  const setLength = (minutes: number) => {
    const span = spanOfLength(start, minutes);
    setStart(span.startMinute);
    setEnd(span.endMinute);
  };

  const selectStart = (nextStart: number, close = true) => {
    const length = Math.max(MIN_BLOCK_MINUTES, end - start);
    const span = clampSpan(nextStart, nextStart + length);
    setStart(span.startMinute);
    setEnd(span.endMinute);
    if (close) setStartOpen(false);
  };

  const selectEnd = (nextEnd: number, close = true) => {
    if (nextEnd >= start + MIN_BLOCK_MINUTES) {
      setEnd(Math.min(MINUTES_PER_DAY, nextEnd));
    }
    if (close) setEndOpen(false);
  };

  const startOptions = useMemo(() => startTimeOptions(start), [start]);
  const endOptions = useMemo(() => endTimeOptions(start, end), [start, end]);
  const selectedPickerDate = useMemo(() => isoToPickerDate(dateISO), [dateISO]);

  const activeKindMeta = KINDS.find((option) => option.value === kind);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Subtle dim on phones; transparent click-away on desktop so the live
            calendar grid and ghost block stay crisp beside the floating card. */}
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[1px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:bg-transparent sm:backdrop-blur-none"
        />

        <DialogPrimitive.Content
          ref={setContentEl}
          data-slot="dialog-content"
          style={
            isDesktop
              ? ({
                  left: position.left,
                  top: position.top,
                  width: CARD_WIDTH_DESKTOP,
                  "--block-accent": accentColor,
                } as CSSProperties)
              : ({
                  "--block-accent": accentColor,
                } as CSSProperties)
          }
          className={cn(
            "fixed z-50 outline-none duration-150",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:data-open:slide-in-from-bottom-4 max-sm:data-closed:slide-out-to-bottom-4",
            isDesktop &&
              (position.placement === "right"
                ? "sm:data-open:slide-in-from-left-1.5"
                : position.placement === "left"
                  ? "sm:data-open:slide-in-from-right-1.5"
                  : "sm:data-open:slide-in-from-bottom-1.5"),
          )}
        >
          {/* Accessible title & description for screen readers and Radix invariants */}
          <DialogPrimitive.Title className="sr-only">
            {editing ? "Edit block" : "New calendar block"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {editing
              ? "Edit time, kind, tasks, or notes for this calendar block."
              : "Set a title, time range, kind, and optional tasks for a new calendar block."}
          </DialogPrimitive.Description>

          <div className="bg-popover/96 border-border/80 text-popover-foreground flex max-h-[90dvh] flex-col overflow-hidden rounded-t-[20px] border shadow-2xl ring-1 ring-foreground/8 backdrop-blur-xl sm:max-h-[min(calc(100dvh-2rem),42rem)] sm:rounded-[20px]">
            {/* Top live accent strip */}
            <div
              aria-hidden
              className={cn(
                "h-1 w-full shrink-0 transition-colors duration-200",
                kind === "BUFFER" && "opacity-45",
              )}
              style={{ backgroundColor: "var(--block-accent)" }}
            />

            {/* Mobile sheet grab handle */}
            <div
              aria-hidden
              className="flex justify-center pt-2 sm:hidden"
            >
              <span className="bg-muted-foreground/25 h-1 w-9 rounded-full" />
            </div>

            {/* Compact Google Calendar utility bar */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2.5 pb-1">
              <div className="flex min-w-0 items-center gap-2 text-micro text-muted-foreground">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full transition-colors duration-200",
                    kind === "BUFFER" && "border border-dashed border-muted-foreground bg-transparent",
                  )}
                  style={
                    kind === "BUFFER"
                      ? undefined
                      : { backgroundColor: "var(--block-accent)" }
                  }
                />
                <span className="font-medium text-foreground/80">
                  {editing ? "Edit block" : "New block"}
                </span>
                {duration > 0 && (
                  <>
                    <span aria-hidden className="opacity-45">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMinuteLength(duration)}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                {draft.id && (
                  <ConfirmDialog
                    title="Delete this block?"
                    description="The time opens back up. Anything you logged against the task stays put."
                    confirmLabel="Delete it"
                    onConfirm={async () => {
                      const formData = new FormData();
                      formData.set("id", draft.id!);
                      await deleteBlock(formData);
                      toast.success("Gone.");
                      onClose();
                    }}
                    trigger={(openConfirm) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={openConfirm}
                        aria-label="Delete block"
                        title="Delete block"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-9 rounded-[10px]"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    )}
                  />
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close"
                  title="Close (Esc)"
                  className="text-muted-foreground hover:text-foreground size-9 rounded-[10px]"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>

            <form
              ref={formRef}
              action={formAction}
              className="flex min-h-0 flex-1 flex-col"
            >
              {draft.id && <input type="hidden" name="id" value={draft.id} />}
              <input type="hidden" name="date" value={dateISO} />
              <input type="hidden" name="startMinute" value={start} />
              <input type="hidden" name="endMinute" value={end} />
              <input type="hidden" name="kind" value={kind} />
              <input
                type="hidden"
                name="beatMinutes"
                value={paced ? String(beatMinutes) : ""}
              />
              {taskIds.map((id) => (
                <input key={id} type="hidden" name="taskIds[]" value={id} />
              ))}
              {/* Always submitted, so unticking is a decision the server hears */}
              <input
                type="hidden"
                name="includeCue"
                value={String(cueTitle ? includeCue : false)}
              />

              {/* Scrollable content body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-4">
                {/* Hero borderless title input (Google Calendar style) */}
                <div className="group/title relative pb-1">
                  <label htmlFor="block-title" className="sr-only">
                    Title
                  </label>
                  <input
                    id="block-title"
                    name="title"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={
                      taskIds.length > 0 ? "Add title (optional)" : "Add title"
                    }
                    className="font-display text-foreground placeholder:text-muted-foreground/50 w-full bg-transparent pt-1 pb-2 text-[1.375rem] leading-snug tracking-tight outline-none"
                  />
                  <div className="bg-border/70 relative h-[1.5px] w-full overflow-hidden rounded-full">
                    <div
                      aria-hidden
                      className="absolute inset-0 origin-center scale-x-0 transition-transform duration-200 group-focus-within/title:scale-x-100"
                      style={{ backgroundColor: "var(--block-accent)" }}
                    />
                  </div>
                  {error("title") && (
                    <p role="alert" className="text-destructive mt-1.5 text-micro">
                      {error("title")}
                    </p>
                  )}
                </div>

                {/* Single-row Kind pill bar (Work · Recovery · Buffer · Break) */}
                <div className="mt-3">
                  <div
                    role="group"
                    aria-label="Block kind"
                    className="bg-secondary/50 grid grid-cols-4 gap-1 rounded-[12px] p-1"
                  >
                    {KINDS.map((option) => {
                      const Icon = option.icon;
                      const active = kind === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setKind(option.value)}
                          aria-pressed={active}
                          title={option.hint}
                          className={cn(
                            "focus-visible:ring-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[9px] px-2 text-micro font-medium transition-all focus-visible:ring-2 focus-visible:outline-none",
                            active
                              ? option.value === "RECOVERY"
                                ? "bg-rest-muted text-foreground ring-rest/45 shadow-xs ring-1"
                                : option.value === "DAYDREAM"
                                  ? "bg-violet-400/15 text-foreground shadow-xs ring-1 ring-violet-400/40"
                                  : "bg-card text-foreground ring-border/70 shadow-xs ring-1"
                              : "text-muted-foreground hover:text-foreground hover:bg-card/45",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-3.5 shrink-0",
                              active
                                ? option.value === "RECOVERY"
                                  ? "text-rest"
                                  : option.value === "DAYDREAM"
                                    ? "text-violet-400"
                                    : option.value === "WORK"
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                : "opacity-70",
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Google Calendar icon-aligned rows */}
                <div className="mt-4 space-y-3.5">
                  {/* Row 1: Date & Time */}
                  <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3">
                    <Clock
                      className="text-muted-foreground mt-2.5 size-4"
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Date picker popover */}
                        <PopoverPrimitive.Root
                          open={dateOpen}
                          onOpenChange={setDateOpen}
                        >
                          <PopoverPrimitive.Trigger asChild>
                            <button
                              type="button"
                              aria-label="Choose date"
                              className="bg-muted/45 hover:bg-muted focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-label font-medium transition-colors hover:border-border/60 focus-visible:ring-2 focus-visible:outline-none"
                            >
                              <CalendarIcon
                                className="text-muted-foreground size-3.5 shrink-0"
                                aria-hidden
                              />
                              <span>{formatShortDateLabel(dateISO)}</span>
                            </button>
                          </PopoverPrimitive.Trigger>
                          <PopoverPrimitive.Portal
                            container={contentEl ?? undefined}
                          >
                            <PopoverPrimitive.Content
                              align="start"
                              sideOffset={6}
                              className="bg-popover text-popover-foreground z-50 rounded-xl border border-border/80 p-1 shadow-xl ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
                            >
                              <Calendar
                                mode="single"
                                selected={selectedPickerDate}
                                defaultMonth={selectedPickerDate}
                                onSelect={(picked) => {
                                  if (!picked) return;
                                  setDateISO(pickerDateToISO(picked));
                                  setDateOpen(false);
                                }}
                              />
                            </PopoverPrimitive.Content>
                          </PopoverPrimitive.Portal>
                        </PopoverPrimitive.Root>

                        {/* Inline From – Until scrollable 15-min time pickers */}
                        <div className="flex items-center gap-1">
                          <TimePickerPopover
                            open={startOpen}
                            onOpenChange={setStartOpen}
                            container={contentEl}
                            label="Start time"
                            valueLabel={formatMinuteOfDay(start)}
                            selectedMinute={start}
                            options={startOptions}
                            formatOption={(m) => formatMinuteOfDay(m)}
                            onSelect={selectStart}
                          />
                          <span
                            aria-hidden
                            className="text-muted-foreground/70 px-0.5 text-label"
                          >
                            –
                          </span>
                          <TimePickerPopover
                            open={endOpen}
                            onOpenChange={setEndOpen}
                            container={contentEl}
                            label="End time"
                            valueLabel={formatEndMinuteLabel(end)}
                            selectedMinute={end}
                            options={endOptions}
                            formatOption={(m) => formatEndMinuteLabel(m)}
                            formatHint={(m) => formatMinuteLength(m - start)}
                            onSelect={selectEnd}
                          />
                        </div>
                      </div>

                      {/* Quick duration chips */}
                      <div
                        role="group"
                        aria-label="Quick duration"
                        className="flex flex-wrap items-center gap-1"
                      >
                        {LENGTHS.map((minutes) => {
                          const active = end - start === minutes;
                          return (
                            <button
                              key={minutes}
                              type="button"
                              onClick={() => setLength(minutes)}
                              aria-pressed={active}
                              className={cn(
                                "focus-visible:ring-ring inline-flex h-7 items-center rounded-full border px-2.5 font-mono text-micro tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                active
                                  ? "border-primary/40 bg-primary/15 text-foreground font-medium"
                                  : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground bg-transparent",
                              )}
                            >
                              {formatMinuteLength(minutes)}
                            </button>
                          );
                        })}
                      </div>

                      {error("date") && (
                        <p role="alert" className="text-destructive text-micro">
                          {error("date")}
                        </p>
                      )}
                      {error("endMinute") && (
                        <p role="alert" className="text-destructive text-micro">
                          {error("endMinute")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Tasks + Sole-task Colour Popover + Conditional Cue */}
                  <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3">
                    <ListChecks
                      className="text-muted-foreground mt-2.5 size-4"
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-2">
                      {linked.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5">
                          {linked.map((task) => (
                            <li key={task.id} className="flex max-w-full">
                              <span className="bg-muted/55 border-border/70 inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 text-micro">
                                <span
                                  aria-hidden
                                  className="size-2 shrink-0 rounded-full"
                                  style={
                                    isCalendarColor(task.color)
                                      ? calendarDotStyle(
                                          soleTask?.id === task.id
                                            ? taskColor
                                            : task.color,
                                        )
                                      : undefined
                                  }
                                />
                                <span className="max-w-44 truncate text-foreground">
                                  {task.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeTask(task.id)}
                                  aria-label={`Remove ${task.title} from this block`}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-ring grid size-5 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                >
                                  <X className="size-3" aria-hidden />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Searchable task picker popover */}
                        <PopoverPrimitive.Root
                          open={taskPickerOpen}
                          onOpenChange={(next) => {
                            setTaskPickerOpen(next);
                            if (!next) setTaskQuery("");
                          }}
                        >
                          <PopoverPrimitive.Trigger asChild>
                            <button
                              type="button"
                              disabled={
                                taskIds.length >= MAX_BLOCK_TASKS ||
                                (tasks.length === 0 && linked.length === 0)
                              }
                              className="bg-muted/45 hover:bg-muted focus-visible:ring-ring text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-label transition-colors hover:border-border/60 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                            >
                              <Plus className="size-3.5 shrink-0" aria-hidden />
                              <span>
                                {taskIds.length >= MAX_BLOCK_TASKS
                                  ? `Limit of ${MAX_BLOCK_TASKS} tasks reached`
                                  : tasks.length === 0
                                    ? "No open tasks left"
                                    : linked.length === 0
                                      ? "Add tasks or habits"
                                      : "Add another"}
                              </span>
                            </button>
                          </PopoverPrimitive.Trigger>
                          <PopoverPrimitive.Portal
                            container={contentEl ?? undefined}
                          >
                            <PopoverPrimitive.Content
                              align="start"
                              sideOffset={6}
                              className="bg-popover text-popover-foreground z-50 w-72 overflow-hidden rounded-xl border border-border/80 shadow-xl ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
                            >
                              {tasks.length > 5 && (
                                <div className="border-border/60 flex items-center gap-2 border-b px-2.5 py-2">
                                  <Search
                                    className="text-muted-foreground size-3.5 shrink-0"
                                    aria-hidden
                                  />
                                  <input
                                    type="text"
                                    value={taskQuery}
                                    onChange={(e) =>
                                      setTaskQuery(e.target.value)
                                    }
                                    placeholder="Filter tasks…"
                                    className="placeholder:text-muted-foreground/60 w-full bg-transparent text-label outline-none"
                                  />
                                </div>
                              )}
                              <div className="max-h-52 overflow-y-auto p-1">
                                {availableTasks.length === 0 ? (
                                  <p className="text-muted-foreground px-2.5 py-3 text-center text-micro">
                                    {taskQuery.trim()
                                      ? "No matching tasks."
                                      : "All open tasks are already in this block."}
                                  </p>
                                ) : (
                                  availableTasks.map((task) => (
                                    <button
                                      key={task.id}
                                      type="button"
                                      onClick={() => addTask(task.id)}
                                      className="hover:bg-accent/60 focus-visible:bg-accent/60 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-label transition-colors outline-none"
                                    >
                                      <span
                                        aria-hidden
                                        className="size-2 shrink-0 rounded-full"
                                        style={
                                          isCalendarColor(task.color)
                                            ? calendarDotStyle(task.color)
                                            : undefined
                                        }
                                      />
                                      <span className="min-w-0 flex-1 truncate">
                                        {task.title}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </PopoverPrimitive.Content>
                          </PopoverPrimitive.Portal>
                        </PopoverPrimitive.Root>

                        {/* Compact Google Calendar color dot popover for sole linked task */}
                        {soleTask && (
                          <PopoverPrimitive.Root
                            open={colorOpen}
                            onOpenChange={setColorOpen}
                          >
                            <PopoverPrimitive.Trigger asChild>
                              <button
                                type="button"
                                aria-label="Change task colour"
                                title="Change task colour (updates all blocks for this task)"
                                className="bg-muted/45 hover:bg-muted focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-transparent px-2.5 text-micro font-medium text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <span
                                  aria-hidden
                                  className="size-3.5 rounded-full border border-black/10"
                                  style={{
                                    backgroundColor: CALENDAR_COLORS[taskColor],
                                  }}
                                />
                                <span className="capitalize">{taskColor}</span>
                                <ChevronDown
                                  className="size-3 opacity-60"
                                  aria-hidden
                                />
                              </button>
                            </PopoverPrimitive.Trigger>
                            <PopoverPrimitive.Portal
                              container={contentEl ?? undefined}
                            >
                              <PopoverPrimitive.Content
                                align="start"
                                sideOffset={6}
                                className="bg-popover text-popover-foreground z-50 w-56 rounded-xl border border-border/80 p-3 shadow-xl ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
                              >
                                <div className="grid grid-cols-5 gap-1.5">
                                  {CALENDAR_COLOR_NAMES.map((option) => {
                                    const active = taskColor === option;
                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={() => pickTaskColor(option)}
                                        aria-label={`${option} colour`}
                                        aria-pressed={active}
                                        title={option}
                                        className="hover:bg-accent/60 focus-visible:ring-ring grid size-9 place-items-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                      >
                                        <span
                                          className={cn(
                                            "grid size-5 place-items-center rounded-full border border-black/10 transition-transform",
                                            active &&
                                              "ring-accent-foreground scale-110 ring-2 ring-offset-2 ring-offset-popover",
                                          )}
                                          style={{
                                            backgroundColor:
                                              CALENDAR_COLORS[option],
                                          }}
                                        >
                                          {active && (
                                            <Check
                                              className="size-3 text-white drop-shadow-xs"
                                              aria-hidden
                                            />
                                          )}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-muted-foreground mt-2 text-micro leading-snug">
                                  Updates every calendar block for this task.
                                </p>
                              </PopoverPrimitive.Content>
                            </PopoverPrimitive.Portal>
                          </PopoverPrimitive.Root>
                        )}
                      </div>

                      {/* Habit cue callout */}
                      {cueTitle && (
                        <label className="border-primary/35 bg-accent/35 flex cursor-pointer items-start gap-2.5 rounded-[12px] border px-3 py-2">
                          <input
                            type="checkbox"
                            checked={includeCue}
                            onChange={(event) =>
                              setIncludeCue(event.target.checked)
                            }
                            className="accent-primary mt-0.5 size-3.5 shrink-0"
                          />
                          <span className="text-micro leading-snug">
                            <span className="inline-flex items-center gap-1 text-foreground font-medium">
                              <Link2 className="size-3 shrink-0" aria-hidden />
                              Also block {cueTitle} before it
                            </span>
                            <span className="text-muted-foreground mt-0.5 block">
                              Starts this habit stack. Untick to skip today.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Interval Cadence ("One thing every") */}
                  {kind === "WORK" && (
                    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3">
                      <Timer
                        className="text-muted-foreground size-4"
                        aria-hidden
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          role="group"
                          aria-label="Interval cadence"
                          className="bg-secondary/50 inline-flex gap-0.5 rounded-[10px] p-0.5"
                        >
                          {PACES.map((option) => {
                            const active = beatMinutes === option.value;
                            return (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => setBeatMinutes(option.value)}
                                aria-pressed={active}
                                className={cn(
                                  "focus-visible:ring-ring inline-flex min-h-8 items-center rounded-[8px] px-2.5 font-mono text-micro tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                  active
                                    ? "bg-card text-foreground ring-border/70 font-medium shadow-xs ring-1"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <span className="text-muted-foreground text-micro">
                          {paced ? (
                            <>
                              <span className="text-foreground font-mono font-medium tabular-nums">
                                {intervals}
                              </span>{" "}
                              interval{intervals === 1 ? "" : "s"}
                              {draft.id &&
                                draft.beatMinutes !== null &&
                                draft.beatMinutes !== beatMinutes && (
                                  <span className="text-destructive ml-1.5">
                                    · clears ticks
                                  </span>
                                )}
                            </>
                          ) : (
                            "Interval pace"
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Row 5: Notes */}
                  <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3">
                    <AlignLeft
                      className="text-muted-foreground mt-2.5 size-4"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <label htmlFor="block-notes" className="sr-only">
                        Notes
                      </label>
                      <textarea
                        id="block-notes"
                        name="notes"
                        rows={2}
                        maxLength={5000}
                        defaultValue={draft.notes}
                        placeholder="Add notes…"
                        onKeyDown={(event) => {
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === "Enter" &&
                            namedOrStaffed &&
                            !pending
                          ) {
                            event.preventDefault();
                            formRef.current?.requestSubmit();
                          }
                        }}
                        className="bg-muted/35 hover:bg-muted/50 focus:bg-input-surface focus:border-input placeholder:text-muted-foreground/60 focus-visible:ring-ring/50 w-full resize-none rounded-[10px] border border-transparent px-3 py-2 text-label leading-relaxed transition-colors outline-none focus-visible:ring-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky footer */}
              <div className="border-border/60 bg-muted/25 flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3">
                <p className="text-muted-foreground min-w-0 truncate text-micro">
                  {kind !== "WORK" && activeKindMeta
                    ? activeKindMeta.hint
                    : !namedOrStaffed
                      ? "Add a title or task to save."
                      : "Enter to save"}
                </p>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="min-h-10 rounded-[10px] px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pending || !namedOrStaffed}
                    className="min-h-10 rounded-[10px] px-4 font-medium"
                  >
                    {pending ? "Saving…" : editing ? "Save" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Scrollable 15-minute time dropdown (Google Calendar style) with auto-scroll
 * to the selected slot and an exact-time input fallback at the bottom.
 */
function TimePickerPopover({
  open,
  onOpenChange,
  container,
  label,
  valueLabel,
  selectedMinute,
  options,
  formatOption,
  formatHint,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLDivElement | null;
  label: string;
  valueLabel: string;
  selectedMinute: number;
  options: number[];
  formatOption: (minute: number) => string;
  formatHint?: (minute: number) => string;
  onSelect: (minute: number, close?: boolean) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selected = listRef.current?.querySelector<HTMLElement>(
        '[data-selected="true"]',
      );
      selected?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="bg-muted/45 hover:bg-muted focus-visible:ring-ring inline-flex min-h-9 items-center rounded-[10px] border border-transparent px-2.5 font-mono text-label tabular-nums transition-colors hover:border-border/60 focus-visible:ring-2 focus-visible:outline-none"
        >
          {valueLabel}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="bg-popover text-popover-foreground z-50 w-44 overflow-hidden rounded-xl border border-border/80 shadow-xl ring-1 ring-foreground/5 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        >
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1"
            role="listbox"
            aria-label={label}
          >
            {options.map((minute) => {
              const selected = minute === selectedMinute;
              return (
                <button
                  key={minute}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected || undefined}
                  onClick={() => onSelect(minute)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 font-mono text-label tabular-nums transition-colors outline-none",
                    selected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-accent/60 focus-visible:bg-accent/60 text-foreground",
                  )}
                >
                  <span>{formatOption(minute)}</span>
                  {formatHint && (
                    <span
                      className={cn(
                        "text-micro",
                        selected
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatHint(minute)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-border/60 border-t px-2 py-1.5">
            <label className="text-muted-foreground flex items-center justify-between gap-2 text-micro">
              <span>Exact</span>
              <input
                type="time"
                step={300}
                value={
                  selectedMinute >= MINUTES_PER_DAY
                    ? "23:59"
                    : formatMinuteOfDay(selectedMinute)
                }
                onChange={(event) => {
                  const parsed = parseMinuteOfDay(event.target.value);
                  if (parsed !== null) onSelect(parsed, false);
                }}
                className="border-input bg-input-surface text-foreground rounded-md border px-1.5 py-0.5 font-mono text-micro tabular-nums outline-none"
              />
            </label>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
