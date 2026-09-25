"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { completeWithNote } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import {
  JournalSpreadDialog,
  type SpreadEntry,
} from "@/components/journal-spread";
import { DEFAULT_FEEDBACK_PROMPT } from "@/lib/feedback";

/**
 * The /habits side of a feedback habit: the meter can reach today's minimum —
 * the +1 taps, the timer's minutes — but the day stays pending until the note
 * is written. This is the button that writes it, on the right page of the
 * day's journal spread, with the rest of today's habits and notes beside it.
 */
export function HabitFeedbackButton({
  taskId,
  title,
  dateISO,
  dateLabel,
  prompt,
  dayIndex,
}: {
  taskId: string;
  title: string;
  dateISO: string;
  /** Already formatted — the spread's left page header. */
  dateLabel: string;
  prompt: string | null;
  /** Today's habits, notes included, for the spread's left page. */
  dayIndex: SpreadEntry[];
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

      {open && (
        <JournalSpreadDialog
          dateLabel={dateLabel}
          heading="Write today's note"
          blurb={
            <>
              &ldquo;{title}&rdquo; has met today&apos;s minimum, but the day
              only counts once the note is written.
            </>
          }
          prompt={question}
          dayIndex={dayIndex.map((entry) => ({
            ...entry,
            active: entry.id === taskId,
          }))}
          note={note}
          onNoteChange={setNote}
          showNote
          noteRequired
          confirmLabel={pending ? "Saving…" : "Save & mark done"}
          confirmDisabled={note.trim() === "" || pending}
          onConfirm={() => void submit()}
          onCancel={() => setOpen(false)}
          cancelLabel="Not yet"
        />
      )}
    </>
  );
}
