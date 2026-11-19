"use client";

import { Lock, PenLine } from "lucide-react";

import { ritualPrimaryClass } from "@/components/ritual-frame";
import { BalloonGlyph } from "@/components/scenes/balloon-scene";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DUMP_COPY, type DumpKind } from "@/lib/brain-dump";
import type { DumpRow } from "@/lib/mind-data";
import { cn } from "@/lib/utils";

/** "5 min", or "40 sec" for a short one. */
function duration(seconds: number) {
  return seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
}

/** The line under an envelope: how long, how much, what went to tasks. */
export function dumpDetails(row: DumpRow): string {
  if (row.paper) return row.sent ? `On paper · ${row.sent} to tasks` : "On paper";
  const parts = [duration(row.seconds), `${row.words} ${row.words === 1 ? "word" : "words"}`];
  if (row.sent) parts.push(`${row.sent} to tasks`);
  return parts.join(" · ");
}

/**
 * A dump, folded into an airmail envelope and seen from the back: the flap
 * closed, a balloon sticker holding it, the day written underneath. Purely
 * the picture; the card around it decides what a tap does.
 */
export function DumpEnvelopeFace({
  kind,
  sealed,
  row,
  big = false,
}: {
  kind: DumpKind;
  sealed: boolean;
  row?: DumpRow;
  big?: boolean;
}) {
  return (
    <div className={cn("dump-envelope", big && "dump-envelope-big")}>
      <div className="dump-envelope-face relative aspect-[8/5] overflow-hidden">
        {/* The lower folds, then the flap over them. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          <path
            d="M0 100 L44 50 M100 100 L56 50"
            fill="none"
            stroke="var(--dump-crease)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="dump-flap absolute inset-x-0 top-0 h-[50%] w-full"
          aria-hidden
        >
          <path d="M0 0 L50 92 L100 0 Z" fill="var(--dump-flap)" />
          <path d="M0 0 L50 92 L100 0" fill="none" stroke="var(--dump-crease)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>

        {/* The sticker that holds the flap. */}
        <span
          className={cn(
            "dump-seal absolute left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
            big ? "top-[46%] size-12" : "top-[46%] size-10",
          )}
          aria-hidden
        >
          {row?.paper ? (
            <PenLine className={cn("text-[var(--dump-air-a)]", big ? "size-6" : "size-4")} strokeWidth={1.75} />
          ) : (
            <BalloonGlyph className={big ? "h-8" : "h-7"} />
          )}
        </span>

        {!row && (
          <div className="absolute inset-x-[7%] bottom-[8%] flex items-end justify-between gap-3">
            <p className="font-hand text-2xl leading-none text-[var(--woop-ink)]">{DUMP_COPY[kind].name}</p>
            {sealed && (
              <p className="flex items-center gap-1 text-xs text-[var(--woop-ink-muted)]">
                <Lock className="size-3 shrink-0" aria-hidden />
                Opens tomorrow
              </p>
            )}
          </div>
        )}
        {row && (
          <>
            <p className="absolute top-[7%] left-[7%] text-[0.6875rem] font-medium text-[var(--woop-ink-muted)] tabular-nums">
              {row.dateLabel}, {row.time}
            </p>
            <div className="absolute inset-x-[7%] bottom-[7%] min-w-0">
              <p className="font-hand truncate text-xl leading-none text-[var(--woop-ink)]">{DUMP_COPY[row.kind].name}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[0.6875rem] text-[var(--woop-ink-muted)]">
                {sealed && !row.paper ? (
                  <>
                    <Lock className="size-3 shrink-0" aria-hidden />
                    Opens tomorrow
                  </>
                ) : (
                  dumpDetails(row)
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One envelope on the shelf. Today's stay sealed: rereading straight away
 * pulls you back into what you just let go of. From tomorrow, a tap opens it.
 * A dump done on paper has nothing inside to open.
 */
export function DumpEnvelope({ row, onOpen }: { row: DumpRow; onOpen: (row: DumpRow) => void }) {
  const name = `${DUMP_COPY[row.kind].name}, ${row.dateLabel} at ${row.time}`;
  if (row.sealed || row.paper || row.body === null) {
    const why = row.paper
      ? "Done on paper. Only the day is kept here."
      : "Sealed until tomorrow. Leaving it alone is part of it.";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            aria-label={`${name}. ${why}`}
            className="dump-card rounded-[14px] focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
          >
            <DumpEnvelopeFace kind={row.kind} sealed={row.sealed} row={row} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{why}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      aria-label={`Open ${name}`}
      className="dump-card dump-card-open block w-full rounded-[14px] text-left focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
    >
      <DumpEnvelopeFace kind={row.kind} sealed={false} row={row} />
    </button>
  );
}

/** An old dump, unfolded. Read only: what was let go isn't for editing. */
export function DumpLetter({ row, onClose }: { row: DumpRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        sheetOnPhone
        className="dump-sky flex flex-col gap-0 overflow-hidden border-0 p-0 text-[var(--woop-ink)] ring-[var(--woop-line)] sm:h-[min(720px,calc(100dvh-4rem))] sm:max-w-2xl lg:max-w-3xl"
      >
        <header className="shrink-0 space-y-1 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4 sm:pt-7 lg:px-10 lg:pt-9">
          <p className="text-sm text-[var(--woop-ink-muted)]">
            {row.dateLabel}, {row.time} · {dumpDetails(row)}
          </p>
          <DialogTitle className="font-display text-2xl leading-tight font-normal text-[var(--woop-ink)] lg:text-3xl">
            {DUMP_COPY[row.kind].name}
          </DialogTitle>
          <DialogDescription className="sr-only">A brain dump from {row.dateLabel}, as it was written.</DialogDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 lg:px-10">
          <p className="font-hand text-2xl leading-snug break-words whitespace-pre-wrap sm:text-[1.75rem]">{row.body}</p>
        </div>
        <footer className="woop-glass flex shrink-0 justify-end border-t border-[var(--woop-line)] bg-[var(--woop-scrim)] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:px-10">
          <Button type="button" autoFocus onClick={onClose} className={ritualPrimaryClass}>
            Close
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
