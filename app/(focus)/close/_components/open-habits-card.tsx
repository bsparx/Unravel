"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  CircleDashed,
  HandHeart,
  PenLine,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MISSED_NOTE_MAX_CHARS,
  type OpenHabitItem,
} from "@/lib/ending-summary";
import type { MissedHabitNote, TrackableGroup } from "@/lib/stats-summary";
import { cn } from "@/lib/utils";

import { saveMissedNotes } from "../actions";

function groupIcon(group: TrackableGroup) {
  if (group === "mind") return Brain;
  if (group === "heart") return HandHeart;
  return Repeat;
}

/**
 * Clean, simplistic list of habits and practices still open today.
 *
 * Each row gives two calm choices:
 *   1. Jump straight back and do it (`Do it ↗`)
 *   2. Tap `Note why` to document what got in the way so you don't repeat it
 *
 * When `onChange` is supplied (inside `StepEndingSummary`), notes ride along
 * in the parent form's single submit. When omitted (standalone on `StepOneThing`
 * when Ending Summary is off), notes save inline via `saveMissedNotes`.
 */
export function OpenHabitsCard({
  openItems,
  reasonsByItemId,
  onChangeReason,
  showAllCompleteBanner = true,
  className,
}: {
  openItems: readonly OpenHabitItem[];
  reasonsByItemId: Record<string, string>;
  /** Provided when controlled by the Ending Summary form; omit for standalone save. */
  onChangeReason?: (itemId: string, reason: string) => void;
  showAllCompleteBanner?: boolean;
  className?: string;
}) {
  const standalone = !onChangeReason;
  const [localReasons, setLocalReasons] = useState<Record<string, string>>(
    reasonsByItemId,
  );
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const [id, text] of Object.entries(reasonsByItemId)) {
      if (text.trim()) initial[id] = true;
    }
    return initial;
  });
  const [pending, startTransition] = useTransition();
  const [savedNotice, setSavedNotice] = useState(false);

  const reasons = standalone ? localReasons : reasonsByItemId;

  const setReason = (itemId: string, value: string) => {
    setSavedNotice(false);
    if (onChangeReason) {
      onChangeReason(itemId, value);
    } else {
      setLocalReasons((prev) => ({ ...prev, [itemId]: value }));
    }
  };

  const toggleNote = (itemId: string) => {
    setExpandedIds((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleStandaloneSave = () => {
    const payload: MissedHabitNote[] = openItems
      .map(({ item }) => ({
        itemId: item.id,
        title: item.title,
        reason: (reasons[item.id] ?? "").trim(),
      }))
      .filter((entry) => entry.reason.length > 0);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("missedNotes", JSON.stringify(payload));
      const res = await saveMissedNotes(formData);
      if (res.ok) {
        setSavedNotice(true);
        toast.success(
          payload.length > 0 ? "Missed habit notes saved." : "Notes cleared.",
        );
      } else {
        toast.error("Couldn't save notes. Try again.");
      }
    });
  };

  if (openItems.length === 0) {
    if (!showAllCompleteBanner) return null;
    return (
      <div
        className={cn(
          "border-flow/30 bg-flow-muted/45 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-label text-foreground",
          className,
        )}
      >
        <CheckCircle2 className="text-flow size-4 shrink-0" aria-hidden />
        <span>Everything scheduled for today is complete.</span>
      </div>
    );
  }

  const notedCount = openItems.filter(
    ({ item }) => (reasons[item.id] ?? "").trim().length > 0,
  ).length;

  return (
    <section
      aria-label="Still open today"
      className={cn(
        "bg-card rounded-[24px] border border-[var(--card-edge)] p-5 shadow-[var(--card-shadow)] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display flex items-center gap-2 text-title font-medium">
            <CircleDashed
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
            <span>Still open today</span>
            <span className="text-muted-foreground font-mono text-micro font-medium tabular-nums">
              {openItems.length}
            </span>
          </h2>
          <p className="text-muted-foreground mt-0.5 text-label">
            Go back to finish one, or note why it slipped so you can plan around
            it tomorrow.
          </p>
        </div>
        {notedCount > 0 && (
          <span className="border-border/70 bg-muted/50 text-muted-foreground rounded-full border px-2.5 py-0.5 font-mono text-micro tabular-nums">
            {notedCount} noted
          </span>
        )}
      </div>

      <ul className="divide-border/50 divide-y rounded-2xl border border-border/60 bg-background/35">
        {openItems.map(({ item, href }) => {
          const Icon = groupIcon(item.group);
          const value = reasons[item.id] ?? "";
          const hasNote = value.trim().length > 0;
          const open = Boolean(expandedIds[item.id]);

          return (
            <li key={item.id} className="px-3.5 py-3 sm:px-4">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="bg-muted/70 text-muted-foreground grid size-8 shrink-0 place-items-center rounded-xl"
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-label font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-muted-foreground truncate text-micro">
                      {item.minimalTask ?? item.scheduleLabel}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleNote(item.id)}
                    aria-expanded={open}
                    className={cn(
                      "focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      hasNote
                        ? "border-primary/35 bg-accent/60 text-accent-foreground"
                        : open
                          ? "border-border bg-muted/70 text-foreground"
                          : "border-border/65 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <PenLine className="size-3 shrink-0" aria-hidden />
                    <span>{hasNote ? "Noted" : "Note why"}</span>
                  </button>

                  <Link
                    href={href}
                    className="border-border/65 text-muted-foreground hover:border-primary/40 hover:bg-accent/40 hover:text-foreground focus-visible:ring-ring inline-flex min-h-9 items-center gap-1 rounded-xl border px-2.5 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span>Do it</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                  </Link>
                </div>
              </div>

              {open && (
                <div className="mt-2.5 pl-10.5">
                  <label htmlFor={`missed-${item.id}`} className="sr-only">
                    Why did {item.title} slip today?
                  </label>
                  <Input
                    id={`missed-${item.id}`}
                    value={value}
                    onChange={(event) => setReason(item.id, event.target.value)}
                    maxLength={MISSED_NOTE_MAX_CHARS}
                    placeholder="Why did this slip today? (optional)"
                    className="h-9 rounded-xl bg-card/80 text-label"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {standalone && (notedCount > 0 || savedNotice) && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {savedNotice && (
            <span className="text-flow inline-flex items-center gap-1 text-micro font-medium">
              <Check className="size-3.5" aria-hidden />
              Saved to today&apos;s report
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleStandaloneSave}
            className="min-h-9 rounded-xl"
          >
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </div>
      )}
    </section>
  );
}
