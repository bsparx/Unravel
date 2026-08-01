"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/lib/dates";
import { MODE_LABELS, type TimerMode } from "@/lib/timer-math";
import { cn } from "@/lib/utils";

import { adjustLoggedTime } from "@/app/(app)/timer/actions";

export type LoggedSession = {
  id: string;
  mode: TimerMode;
  /** Already formatted server-side, in the user's timezone. */
  startedLabel: string;
  elapsedSeconds: number;
  overtimeSeconds: number;
  /** What the clock measured, if this row has since been corrected by hand. */
  measuredSeconds: number | null;
};

/**
 * The log, with every row correctable.
 *
 * Editing is deliberately not hidden behind a menu, and equally not sitting
 * open as a field per row. A log you can edit at a glance invites fiddling with
 * numbers that were right; a log you can only edit after finding the setting is
 * one where the wrong number just stays. So: one quiet pencil per row, in the
 * same hover-revealed idiom the task list already uses for its row actions.
 *
 * The corrected row keeps saying so afterwards. This is a log — the difference
 * between "the clock measured 17 hours" and "I say it was 5 minutes" is worth
 * more than a tidy list, and it is the thing that stops a corrected estimate
 * being read later as a measured one.
 */
export function SessionLog({ sessions }: { sessions: LoggedSession[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <ul className="text-label">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="border-border/60 group border-b py-2 last:border-b-0"
        >
          {editing === session.id ? (
            <AdjustRow
              session={session}
              onClose={() => setEditing(null)}
            />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">
                {session.startedLabel}
              </span>

              <span className="flex items-center gap-3">
                <span className="text-muted-foreground text-micro tracking-wider uppercase">
                  {MODE_LABELS[session.mode]}
                </span>
                <span className="tabular-nums">
                  {formatDuration(session.elapsedSeconds)}
                </span>
                {session.overtimeSeconds > 0 && (
                  <span className="text-running tabular-nums">
                    +{formatDuration(session.overtimeSeconds)}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "size-7 p-0 opacity-0 transition-opacity",
                    // Never hover-only in practice: focus and touch both need
                    // it, and a control that exists only under a mouse is a
                    // control half the app's users don't have.
                    "group-hover:opacity-100 focus-visible:opacity-100",
                    "max-md:opacity-100",
                  )}
                  onClick={() => setEditing(session.id)}
                  aria-label={`Edit the time logged on ${session.startedLabel}`}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              </span>
            </div>
          )}

          {session.measuredSeconds !== null && editing !== session.id && (
            <p className="text-muted-foreground mt-1 text-micro">
              Edited — the clock had{" "}
              {formatDuration(session.measuredSeconds)}.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function AdjustRow({
  session,
  onClose,
}: {
  session: LoggedSession;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Minutes, because minutes is the unit the mistake was made in. Rounded so
  // the field opens on a number you'd actually type back.
  const [minutes, setMinutes] = useState(
    String(Math.round(session.elapsedSeconds / 60)),
  );

  const save = () => {
    const value = Number(minutes);
    if (!Number.isFinite(value)) {
      toast.error("That isn't a number of minutes.");
      return;
    }

    startTransition(async () => {
      const result = await adjustLoggedTime({
        sessionId: session.id,
        minutes: Math.round(value),
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      onClose();
      // The totals above this list, the day roll-up and every chart that reads
      // it are all server-rendered, so the page has to re-fetch to agree with
      // what was just written.
      router.refresh();
      toast.success(
        result.loggedSeconds === 0
          ? "Logged as no time at all."
          : `Logged as ${formatDuration(result.loggedSeconds)}.`,
      );
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-muted-foreground">{session.startedLabel}</span>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          autoFocus
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") onClose();
          }}
          className="h-8 w-20 tabular-nums"
          aria-label="Minutes logged"
        />
        <span className="text-muted-foreground text-label">min</span>

        <Button size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
