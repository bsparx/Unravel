"use client";

import { useRef, useState } from "react";
import { CornerDownRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { DisputationCard } from "@/lib/disputation";

import { Conviction } from "./disputation-ritual";
import { ritualGhostClass, ritualPrimaryClass } from "./ritual-frame";

/**
 * A disputation, reread. The old thought and what you carry instead, and one
 * question: how strongly does the old thought hold now? Rereading an argument
 * you've already won is how it stays won, and a day you do it keeps the
 * river as much as writing a new one.
 *
 * Presentational: the caller saves. `onDone` resolves true once stored.
 */
export function DisputationRevisit({
  entry,
  onDone,
  onCancel,
}: {
  entry: DisputationCard;
  onDone: (belief: number | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [belief, setBelief] = useState<number | null>(entry.revisit?.today ? entry.revisit.belief : null);
  const [saving, setSaving] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // The last rating there is: an earlier revisit, else where the argument left it.
  const earlier = (entry.revisit && !entry.revisit.today ? entry.revisit.belief : null) ?? entry.beliefAfter ?? entry.beliefBefore;

  const save = async () => {
    setSaving(true);
    const ok = await onDone(belief);
    if (!ok) setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent
        showCloseButton={false}
        sheetOnPhone
        className="isolate flex flex-col gap-0 overflow-hidden border-0 p-0 text-[var(--woop-ink)] sm:max-w-xl lg:max-w-2xl"
        // Land on the reading, not on the "0" (the first control), whose ring
        // would look like an answer already given.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          body.current?.focus({ preventScroll: true });
        }}
      >
        <div aria-hidden className="abcde-sky-energization pointer-events-none absolute inset-0 -z-10" />
        <div ref={body} tabIndex={-1} className="min-h-0 flex-1 space-y-5 overflow-y-auto outline-none px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-5 sm:pt-6 lg:space-y-6 lg:px-9 lg:pt-8">
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-medium tracking-[0.2em] text-[var(--woop-ink-muted)] uppercase">Revisit</p>
            <DialogTitle className="font-display text-xl leading-snug font-normal text-[var(--woop-ink)] lg:text-2xl">
              The thought you argued with
            </DialogTitle>
          </div>
          <p className="font-display text-base leading-snug text-[var(--woop-ink-muted)] line-through decoration-[color-mix(in_oklab,var(--abcde-belief)_60%,transparent)] sm:text-lg lg:text-xl">
            {entry.belief}
          </p>
          <div className="flex items-start gap-2">
            <CornerDownRight className="mt-1.5 size-4 shrink-0 text-[var(--abcde-energization)]" aria-hidden />
            <p className="font-display text-lg leading-snug sm:text-xl lg:text-2xl">{entry.energization}</p>
          </div>
          <DialogDescription className="text-sm text-[var(--woop-ink-muted)]">
            Read it once more. Then, honestly: how strongly does the old thought hold today?
          </DialogDescription>
          <Conviction
            label="The old thought, today (0 to 10)"
            value={belief}
            ghost={earlier}
            ghostLabel="your last rating"
            onChange={setBelief}
          />
        </div>
        <div className="woop-glass flex shrink-0 items-center justify-between gap-2 border-t border-[var(--woop-line)] bg-[var(--woop-scrim)] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:px-9 lg:py-4">
          <Button type="button" variant="ghost" disabled={saving} onClick={onCancel} className={ritualGhostClass}>
            Not now
          </Button>
          <Button type="button" loading={saving} disabled={saving} onClick={() => void save()} className={ritualPrimaryClass}>
            {saving ? "Keeping it…" : "Revisited"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
