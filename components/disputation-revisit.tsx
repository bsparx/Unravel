"use client";

import { useState } from "react";
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
 * harbour as much as writing a new one.
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
        className="isolate gap-0 overflow-hidden border-0 p-0 text-[var(--woop-ink)] sm:max-w-lg"
      >
        <div aria-hidden className="abcde-sky-energization pointer-events-none absolute inset-0 -z-10" />
        <div className="space-y-5 px-6 pt-6 pb-5">
          <div className="space-y-1">
            <p className="text-[0.6875rem] font-medium tracking-[0.2em] text-[var(--woop-ink-muted)] uppercase">Revisit</p>
            <DialogTitle className="font-display text-xl leading-snug font-normal text-[var(--woop-ink)]">
              The thought you argued with
            </DialogTitle>
          </div>
          <p className="font-display text-lg leading-snug text-[var(--woop-ink-muted)] line-through decoration-[color-mix(in_oklab,var(--abcde-belief)_60%,transparent)]">
            {entry.belief}
          </p>
          <div className="flex items-start gap-2">
            <CornerDownRight className="mt-1.5 size-4 shrink-0 text-[var(--abcde-energization)]" aria-hidden />
            <p className="font-display text-xl leading-snug">{entry.energization}</p>
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
        <div className="woop-glass flex items-center justify-between gap-2 border-t border-[var(--woop-line)] bg-[var(--woop-scrim)] px-6 py-3 backdrop-blur-md">
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
