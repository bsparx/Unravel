"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { completeWithNote } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_FEEDBACK_PROMPT } from "@/lib/feedback";

/**
 * The /habits side of a feedback habit: the meter can reach today's minimum —
 * the +1 taps, the timer's minutes — but the day stays pending until the note
 * is written. This is the button that writes it.
 */
export function HabitFeedbackButton({
  taskId,
  title,
  dateISO,
  prompt,
}: {
  taskId: string;
  title: string;
  dateISO: string;
  prompt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const question = prompt || DEFAULT_FEEDBACK_PROMPT;

  const submit = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setPending(true);
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("date", dateISO);
    formData.set("note", trimmed);
    const state = await completeWithNote(formData);
    setPending(false);
    if (state.status === "error") {
      toast.error(state.message);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <PenLine className="size-3.5" aria-hidden />
        Write today&apos;s note
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{question}</DialogTitle>
            <DialogDescription className="text-label">
              &ldquo;{title}&rdquo; has met today&apos;s minimum, but the day
              only counts once the note is written.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="A line is enough — but it has to be a real one."
          />

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button
              type="button"
              disabled={note.trim() === "" || pending}
              onClick={() => void submit()}
            >
              {pending ? "Saving…" : "Save & mark done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
