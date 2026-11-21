"use client";

import { useState } from "react";

import { ritualGhostClass, ritualPrimaryClass } from "@/components/ritual-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DUMP_COPY, DUMP_MAX_TASKS, DUMP_MINUTES, dumpLines, type DumpKind } from "@/lib/brain-dump";
import { cn } from "@/lib/utils";

import type { DumpResult } from "./brain-dump-session";

/**
 * A dump done on paper, the way it's best done: away from the phone. Only
 * the day (and how long you spent, 1–10 min) is kept, so the balloon and
 * statistics count it; anything circled on the page can be typed in and goes
 * on the task list.
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
  const [minutes, setMinutes] = useState("5");
  const [circled, setCircled] = useState("");
  const [saving, setSaving] = useState(false);
  const tasks = dumpLines(circled).slice(0, DUMP_MAX_TASKS);

  const parsedMinutes = Number(minutes);
  const clampedMinutes = Number.isFinite(parsedMinutes)
    ? Math.min(10, Math.max(1, Math.round(parsedMinutes)))
    : 5;

  const save = async () => {
    setSaving(true);
    const ok = await onSave({
      kind,
      body: "",
      seconds: clampedMinutes * 60,
      paper: true,
      tasks,
    });
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
            <label htmlFor="dump-paper-minutes" className="text-sm font-medium">
              How long? <span className="font-normal text-[var(--woop-ink-muted)]">1–10 min</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Quick durations"
                className="inline-flex rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] p-1"
              >
                {DUMP_MINUTES.map((value) => {
                  const active = clampedMinutes === value && minutes !== "";
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setMinutes(String(value))}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none",
                        active
                          ? "bg-[var(--woop-solid)] text-[var(--woop-ink)] shadow-sm"
                          : "text-[var(--woop-ink-muted)] hover:text-[var(--woop-ink)]",
                      )}
                    >
                      {value}m
                    </button>
                  );
                })}
              </div>
              <div className="relative w-24">
                <input
                  id="dump-paper-minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  onBlur={() => setMinutes(String(clampedMinutes))}
                  className="h-9 w-full rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] pr-10 pl-3.5 font-mono text-sm text-[var(--woop-ink)] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-[var(--woop-ink-muted)]">
                  min
                </span>
              </div>
            </div>
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
