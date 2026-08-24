"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ColorSwatches } from "@/components/color-swatches";
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
import {
  formatMinuteOfDay,
  parseMinuteOfDay,
  spanOfLength,
} from "@/lib/block-math";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createBlock, deleteBlock, updateBlock } from "../actions";
import { updateTaskColor } from "@/app/(app)/tasks/actions";

export type BlockDraft = {
  id?: string;
  dateISO: string;
  startMinute: number;
  endMinute: number;
  title: string;
  notes: string;
  taskId: string | null;
  /** The linked task's calendar hue, so the picker opens on it. */
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
    label: "Daydreaming",
    hint: "Imaginary time. Doesn't count toward anything.",
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
  // Controlled, unlike the other Selects here, because the cue offer below has
  // to react to which task is picked.
  const [taskId, setTaskId] = useState(draft.taskId ?? "none");
  const [taskColor, setTaskColor] = useState<CalendarColor>(
    draft.taskColor ?? "teal",
  );
  const [includeCue, setIncludeCue] = useState(true);

  const cueTitle = draft.hasCue
    ? null
    : (tasks.find((task) => task.id === taskId)?.cueTitle ?? null);

  const linkedTask = tasks.find((task) => task.id === taskId) ?? null;

  /** Re-colour the linked task — the block re-tints with it on revalidate. */
  const pickTaskColor = (color: CalendarColor) => {
    setTaskColor(color);
    if (!linkedTask) return;
    const formData = new FormData();
    formData.set("taskId", linkedTask.id);
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
            <Label htmlFor="block-title">What</Label>
            <Input
              id="block-title"
              name="title"
              required
              autoFocus
              maxLength={200}
              defaultValue={draft.title}
              placeholder="Draft the intro"
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

          <div className="space-y-1.5">
            <Label htmlFor="block-task">Against a task</Label>
            <Select name="taskId" value={taskId} onValueChange={setTaskId}>
              <SelectTrigger id="block-task">
                <SelectValue placeholder="Nothing in particular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nothing in particular</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-label">
              Linking it means the timer opens on the right thing, and the time
              lands against that task.
            </p>
          </div>

          {linkedTask && (
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
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : editing ? "Save" : "Block it out"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
