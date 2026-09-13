"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ColorSwatches } from "@/components/color-swatches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarColor } from "@/lib/calendar-colors";
import { calendarDotStyle, isCalendarColor } from "@/lib/calendar-colors";
import {
  formatMinuteOfDay,
  parseMinuteOfDay,
  spanOfLength,
} from "@/lib/block-math";
import { idleState, MAX_BLOCK_TASKS } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createBlock, deleteBlock, updateBlock } from "../actions";
import { updateTaskColor } from "@/app/(app)/tasks/actions";

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
};

const KINDS: { value: BlockDraft["kind"]; label: string; hint: string }[] = [
  { value: "WORK", label: "Work", hint: "Something you're going to do." },
  { value: "RECOVERY", label: "Recovery", hint: "Deliberate rest. It counts." },
  { value: "BUFFER", label: "Buffer", hint: "Left empty on purpose." },
  {
    value: "DAYDREAM",
    label: "Break",
    hint: "A pause that doesn't count toward anything.",
  },
];

/** Quick lengths, in minutes. Long enough a list, short enough to scan. */
const LENGTHS = [15, 25, 45, 60, 90];

/**
 * Always mounted with a `key` derived from the draft — see the call site.
 *
 * That is what makes the times below plain `useState` initialisers rather than
 * an effect that copies props into state: opening a different block remounts
 * the dialog, so there is nothing to re-synchronise. The effect version of
 * this is also a lint error, and correctly so.
 */
export function BlockDialog({
  draft,
  tasks,
  onClose,
}: {
  draft: BlockDraft;
  tasks: { id: string; title: string; cueTitle: string | null; color: string }[];
  onClose: () => void;
}) {
  const editing = Boolean(draft.id);
  const [state, formAction, pending] = useActionState(
    editing ? updateBlock : createBlock,
    idleState,
  );

  const [start, setStart] = useState(draft.startMinute);
  const [end, setEnd] = useState(draft.endMinute);
  const [kind, setKind] = useState<BlockDraft["kind"]>(draft.kind);
  const [title, setTitle] = useState(draft.title);
  // Controlled, unlike the other Selects here, because the cue offer below has
  // to react to which tasks are in.
  const [taskIds, setTaskIds] = useState<string[]>(draft.taskIds);
  const [taskColor, setTaskColor] = useState<CalendarColor>(
    draft.taskColor ?? "teal",
  );
  const [includeCue, setIncludeCue] = useState(true);

  const linked = taskIds
    .map(
      (id) =>
        draft.tasks.find((task) => task.id === id) ??
        tasks.find((task) => task.id === id) ??
        null,
    )
    .filter((task): task is BlockTaskDraft => task !== null);

  // Only one block can be one habit's precursor, so only the first task that
  // has a cue can bring it. See `plannedCueForAny`.
  const cueTitle = draft.hasCue
    ? null
    : (tasks.find((task) => taskIds.includes(task.id) && task.cueTitle)
        ?.cueTitle ?? null);

  // The swatch row edits a task's own hue, so it only means something when
  // there is exactly one task to edit. A block holding three stays the kind's
  // colour: it is a container, not any one of the things in it.
  const soleTask = taskIds.length === 1 ? linked[0] : null;

  // And the block's own name is optional when its tasks already say what it is.
  const namedOrStaffed = title.trim().length > 0 || taskIds.length > 0;

  const addTask = (id: string) => {
    setTaskIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const removeTask = (id: string) => {
    setTaskIds((current) => current.filter((taskId) => taskId !== id));
  };

  /** Re-colour the linked task — the block re-tints with it on revalidate. */
  const pickTaskColor = (color: CalendarColor) => {
    setTaskColor(color);
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit this block" : "Block out some time"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change it, move it, or let it go."
              : "Claiming the time is most of the work. You can always move it."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {draft.id && <input type="hidden" name="id" value={draft.id} />}
          <input type="hidden" name="date" value={draft.dateISO} />
          <input type="hidden" name="startMinute" value={start} />
          <input type="hidden" name="endMinute" value={end} />
          <input type="hidden" name="kind" value={kind} />

          <div className="space-y-1.5">
            <Label htmlFor="block-title">
              What
              <span className="text-muted-foreground font-normal">
                {" "}
                · optional if you add tasks below
              </span>
            </Label>
            <Input
              id="block-title"
              name="title"
              autoFocus
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                taskIds.length > 0 ? "Two hours of the report" : "Deep work"
              }
            />
            {error("title") && (
              <p role="alert" className="text-destructive text-label">
                {error("title")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">From</Label>
              <Input
                id="block-start"
                type="time"
                step={300}
                value={formatMinuteOfDay(start)}
                onChange={(event) => {
                  const minute = parseMinuteOfDay(event.target.value);
                  if (minute === null) return;
                  const length = end - start;
                  setStart(minute);
                  setEnd(minute + length);
                }}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">Until</Label>
              <Input
                id="block-end"
                type="time"
                step={300}
                value={formatMinuteOfDay(end)}
                onChange={(event) => {
                  const minute = parseMinuteOfDay(event.target.value);
                  if (minute !== null) setEnd(minute);
                }}
                className="tabular-nums"
              />
            </div>
          </div>

          {error("endMinute") && (
            <p role="alert" className="text-destructive text-label">
              {error("endMinute")}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {LENGTHS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setLength(minutes)}
                aria-pressed={end - start === minutes}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-2.5 py-0.5 text-label tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  end - start === minutes
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {minutes}m
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Kind</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {KINDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  aria-pressed={kind === option.value}
                  title={option.hint}
                  className={cn(
                    "focus-visible:ring-ring rounded-md border px-2 py-1.5 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    kind === option.value
                      ? option.value === "RECOVERY"
                        ? "border-rest bg-rest-muted"
                        : "border-primary bg-accent"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-label">
              {KINDS.find((option) => option.value === kind)?.hint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="block-task">
              In this block
              {taskIds.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · <span className="tabular-nums">{taskIds.length}</span>
                </span>
              )}
            </Label>

            {/* What's in it. A stack of chips rather than a list, because the
                point of the feature is that the order between them doesn't
                mean anything — a numbered list would imply one. */}
            {linked.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {linked.map((task) => (
                  <li key={task.id} className="flex">
                    <Badge variant="outline" className="gap-1.5 pr-1">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={
                          isCalendarColor(task.color)
                            ? calendarDotStyle(task.color)
                            : undefined
                        }
                      />
                      <span className="max-w-44 truncate">{task.title}</span>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        aria-label={`Take ${task.title} out of this block`}
                        className="text-muted-foreground hover:text-destructive focus-visible:ring-ring rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {/* Add-only, and it resets to the placeholder after each pick, so
                the control never claims to be showing the current value. */}
            <Select value="" onValueChange={addTask} disabled={taskIds.length >= MAX_BLOCK_TASKS}>
              <SelectTrigger id="block-task">
                <SelectValue
                  placeholder={
                    linked.length === 0
                      ? "Pick the tasks this time is for"
                      : taskIds.length >= MAX_BLOCK_TASKS
                        ? "That's as many as one block holds"
                        : "Add another"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {tasks
                  .filter((task) => !taskIds.includes(task.id))
                  .map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* The ids the server actually reads. Absent when the list is
                empty, which is how "name it, put nothing in it" is expressed. */}
            {taskIds.map((id) => (
              <input key={id} type="hidden" name="taskIds[]" value={id} />
            ))}

            <p className="text-muted-foreground text-label">
              {linked.length > 1
                ? "No order between them — the two hours are for all of these."
                : "A block is what the time is for. Add as many as it takes, or none at all."}
            </p>
          </div>

          {soleTask && (
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <ColorSwatches value={taskColor} onChange={pickTaskColor} />
              <p className="text-muted-foreground text-label">
                The task&apos;s hue — every block of it across the calendar
                re-tints with this.
              </p>
            </div>
          )}

          {cueTitle && (
            <label className="border-primary/40 bg-accent/40 flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2">
              <input
                type="checkbox"
                checked={includeCue}
                onChange={(event) => setIncludeCue(event.target.checked)}
                className="accent-primary mt-0.5 size-3.5"
              />
              <span className="text-label">
                Also block{" "}
                <span className="text-foreground font-medium">{cueTitle}</span>{" "}
                immediately before it
                <span className="text-muted-foreground block">
                  That&apos;s what starts this habit. Untick if today&apos;s
                  going to be different.
                </span>
              </span>
            </label>
          )}
          {/* Always submitted, so unticking is a decision the server hears —
              an absent checkbox is indistinguishable from a caller that
              doesn't know about cues, and that one should get the cue. */}
          <input
            type="hidden"
            name="includeCue"
            value={String(cueTitle ? includeCue : false)}
          />

          <div className="space-y-1.5">
            <Label htmlFor="block-notes">Notes</Label>
            <Textarea
              id="block-notes"
              name="notes"
              rows={2}
              maxLength={5000}
              defaultValue={draft.notes}
              placeholder="Optional."
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {draft.id ? (
              // Not a `formAction` on the same form: deleting has to close the
              // dialog, and a void action gives useActionState nothing to react
              // to — the dialog would sit open over a block that no longer
              // exists.
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
                trigger={(open) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={open}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                )}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !namedOrStaffed}>
                {pending ? "Saving…" : editing ? "Save" : "Block it out"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
