"use client";

import type { ReactNode } from "react";

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
import { MAX_FEEDBACK_LENGTH } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { Butterfly, WashiTape } from "./journal-ornaments";

export type SpreadEntry = {
  id: string;
  title: string;
  done: boolean;
  note: string | null;
  active?: boolean;
};

/**
 * The note form as a two-page journal spread.
 *
 * Left page: the day — every task and the note it closed with, so the one
 * being written sits among its siblings instead of alone in a box. Right
 * page: today's page — the prompt, ruled paper, and whatever else the
 * caller is asking (time, often).
 *
 * Presentational on purpose: both note dialogs keep their own state and
 * submit logic and pass it in. The paper, the gutter and the ornaments live
 * here so the two doors into journaling are the same door.
 */
export function JournalSpreadDialog({
  dateLabel,
  heading,
  blurb,
  prompt,
  dayIndex,
  note,
  onNoteChange,
  showNote,
  noteRequired,
  placeholder = "A line is enough — but it has to be a real one.",
  children,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onCancel,
  cancelLabel = "Go back",
}: {
  /** "Thu, Sep 25" — already formatted by the caller's date helper. */
  dateLabel: string;
  heading: string;
  blurb: ReactNode;
  /** The habit's own question. Omit to skip the note block entirely. */
  prompt?: string;
  dayIndex: SpreadEntry[];
  note: string;
  onNoteChange: (value: string) => void;
  showNote: boolean;
  /** The note is the condition of completion, not just a keepsake. */
  noteRequired: boolean;
  placeholder?: string;
  /** The time panel and any constraint line, under the note. */
  children?: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const journaled = dayIndex.filter((entry) => entry.note?.trim()).length;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="border-paper-edge bg-paper text-paper-ink ring-paper-edge/60 gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex flex-col-reverse sm:flex-row">
          {/* ── Left page: the day ─────────────────────────────────────── */}
          <aside className="border-paper-edge bg-paper-edge/15 relative w-full shrink-0 border-b px-5 pt-8 pb-5 sm:w-[38%] sm:border-r sm:border-b-0 sm:shadow-[inset_-14px_0_18px_-16px_rgba(42,36,28,0.35)]">
            <WashiTape className="absolute top-2 left-4" rotate="-3deg" />

            <p className="text-paper-ink-muted text-micro mb-0.5 font-sans font-medium tracking-wider uppercase">
              The day
            </p>
            <p className="font-hand text-paper-ink text-3xl leading-none">
              {dateLabel}
            </p>
            <p className="text-paper-ink-muted tnum mt-1 font-mono text-micro">
              {journaled} of {dayIndex.length} journaled
            </p>

            <ul className="mt-4 space-y-2.5">
              {dayIndex.map((entry) => (
                <li
                  key={entry.id}
                  aria-current={entry.active ? "true" : undefined}
                  className={cn(
                    "min-w-0",
                    entry.active &&
                      "bg-washi/40 -mx-1.5 rounded-sm px-1.5 py-0.5",
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "font-hand shrink-0 text-lg leading-none",
                        entry.done
                          ? "text-primary"
                          : entry.active
                            ? "text-paper-ink"
                            : "text-paper-ink-muted/70",
                      )}
                    >
                      {entry.done ? "✓" : entry.active ? "●" : "○"}
                    </span>
                    <span
                      className={cn(
                        "font-hand min-w-0 flex-1 text-lg leading-snug",
                        entry.active
                          ? "text-paper-ink underline decoration-washi decoration-2 underline-offset-4"
                          : "text-paper-ink/90",
                        entry.done && !entry.active && "text-paper-ink/70",
                      )}
                    >
                      {entry.title}
                    </span>
                  </div>
                  {entry.note?.trim() && (
                    <p className="font-hand text-paper-ink-muted mt-0.5 line-clamp-2 pl-6 text-base leading-snug">
                      {entry.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <Butterfly
              filled
              className="text-paper-ink-muted/60 absolute right-4 bottom-3 size-6 rotate-6"
            />
          </aside>

          {/* ── Right page: today's page ───────────────────────────────── */}
          <div className="relative min-w-0 flex-1 px-5 pt-8 pb-5 sm:shadow-[inset_14px_0_18px_-16px_rgba(42,36,28,0.35)]">
            <WashiTape
              className="absolute top-2 right-10"
              rotate="2deg"
            />

            <DialogHeader className="gap-1.5">
              <DialogTitle className="font-hand text-paper-ink text-3xl leading-none">
                {heading}
              </DialogTitle>
              <DialogDescription className="text-paper-ink-muted text-label">
                {blurb}
              </DialogDescription>
            </DialogHeader>

            {showNote && (
              <div className="mt-4 space-y-1.5">
                {prompt && (
                  <label
                    htmlFor="spread-note"
                    className="font-display text-paper-ink block text-title italic"
                  >
                    {prompt}
                  </label>
                )}
                {/* The rules live on the wrapper: Chromium won't reliably
                    paint background images inside a textarea. */}
                <div className="paper-ruled border-paper-edge/70 rounded-md border-0 border-b">
                  <Textarea
                    id="spread-note"
                    rows={4}
                    maxLength={MAX_FEEDBACK_LENGTH}
                    aria-required={noteRequired}
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    placeholder={placeholder}
                    className={cn(
                      "text-paper-ink placeholder:text-paper-ink-muted/70",
                      "font-hand min-h-32 rounded-md border-0 bg-transparent px-1 py-0 text-xl leading-[1.9rem] shadow-none",
                      "dark:bg-transparent focus-visible:ring-primary/40 focus-visible:ring-2",
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "text-paper-ink-muted tnum text-right font-mono text-micro",
                    note.trim().length > MAX_FEEDBACK_LENGTH && "text-destructive",
                  )}
                  aria-live="polite"
                >
                  {note.trim().length > MAX_FEEDBACK_LENGTH
                    ? `${note.length} / ${MAX_FEEDBACK_LENGTH} — over the limit`
                    : `${note.length} / ${MAX_FEEDBACK_LENGTH}`}
                </p>
              </div>
            )}

            {children}
          </div>
        </div>

        <DialogFooter className="border-paper-edge bg-paper-edge/15 sm:justify-between m-0 gap-2 rounded-none border-t p-3">
          <Button
            type="button"
            variant="ghost"
            className="text-paper-ink hover:bg-paper-edge/40 hover:text-paper-ink"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={confirmDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Butterfly, WashiTape };
