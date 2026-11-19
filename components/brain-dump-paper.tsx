"use client";

import { useState } from "react";

import { ritualGhostClass, ritualPrimaryClass } from "@/components/ritual-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DUMP_COPY, DUMP_MAX_TASKS, dumpLines, type DumpKind } from "@/lib/brain-dump";
import { cn } from "@/lib/utils";

import type { DumpResult } from "./brain-dump-session";

/**
 * A dump done on paper, the way it's best done: away from the phone. Only
 * the day is kept, so the balloon counts it; anything circled on the page
 * can be typed in and goes on the task list.
 */
export function BrainDumpPaper({
  kind,
  onSave,
  onCancel,
}: {
  kind: DumpKind;
  onSave: (result: DumpResult) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [circled, setCircled] = useState("");
  const [saving, setSaving] = useState(false);
  const tasks = dumpLines(circled).slice(0, DUMP_MAX_TASKS);

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ kind, body: "", seconds: 0, paper: true, tasks });
    if (!ok) setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <DialogContent
        showCloseButton={false}
        sheetOnPhone
        className="dump-sky flex flex-col gap-0 overflow-hidden border-0 p-0 text-[var(--woop-ink)] ring-[var(--woop-line)] sm:max-w-lg"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 sm:pt-7">
          <div className="space-y-1.5">
            <p className="text-sm text-[var(--woop-ink-muted)]">{DUMP_COPY[kind].name}, on paper</p>
            <DialogTitle className="font-display text-2xl leading-tight font-normal text-[var(--woop-ink)]">
              Done on paper
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--woop-ink-muted)]">
              The best way to do it: no screen, no notifications. This keeps today for the balloon. What you wrote stays on
              the page.
            </DialogDescription>
          </div>
          <div className="space-y-2">
            <label htmlFor="dump-circled" className="text-sm font-medium">
              Circled anything? <span className="font-normal text-[var(--woop-ink-muted)]">Optional</span>
            </label>
            <textarea
              id="dump-circled"
              value={circled}
              onChange={(event) => setCircled(event.target.value.slice(0, 4000))}
              rows={4}
              aria-describedby="dump-circled-hint"
              placeholder={"Book the dentist\nReply about Saturday"}
              className="font-hand w-full resize-none rounded-2xl border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] px-4 py-3 text-xl leading-snug text-[var(--woop-ink)] outline-none placeholder:text-[var(--woop-ink)]/50 focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)]"
            />
            <p id="dump-circled-hint" className="text-xs text-[var(--woop-ink-muted)]" aria-live="polite">
              {tasks.length === 0
                ? `One to a line. Each goes on your task list${kind === "TOMORROW" ? ", due tomorrow" : " with no date"}.`
                : `${tasks.length} to your task list${kind === "TOMORROW" ? ", due tomorrow" : ""}.`}
            </p>
          </div>
        </div>
        <div className="woop-glass flex shrink-0 items-center justify-between gap-2 border-t border-[var(--woop-line)] bg-[var(--woop-scrim)] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <Button type="button" variant="ghost" disabled={saving} onClick={onCancel} className={cn(ritualGhostClass, "rounded-full")}>
            Not now
          </Button>
          <Button type="button" loading={saving} disabled={saving} onClick={() => void save()} className={ritualPrimaryClass}>
            {saving ? "Keeping it…" : "Keep the day"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
