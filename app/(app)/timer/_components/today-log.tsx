"use client";

import { useState } from "react";

import { SessionLog } from "@/components/session-log";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { TodayLog as TodayLogData } from "../_lib/today-log";

/**
 * "How long have I spent on this today" — the number the timer screen was
 * missing.
 *
 * The big readout answers a different question: how far into *this* session
 * you are. That is the right thing for the face to show and the wrong thing to
 * plan the rest of your afternoon on, because it resets every time you press
 * start. Someone who has already given a task two hours today sees "08:14" and
 * has nothing on screen telling them otherwise.
 *
 * It is deliberately quiet — one muted line under the controls. The face is
 * the page and this is context, not a second clock competing with it.
 */
export function TodayLog({
  log,
  liveSeconds,
  live,
  unit,
}: {
  log: TodayLogData;
  /** Seconds on the clock right now, or 0 when nothing is running. */
  liveSeconds: number;
  /** Whether `liveSeconds` belongs to a session that hasn't been committed. */
  live: boolean;
  /** "logged" for a todo; habits count minutes toward a quota. */
  unit: "todo" | "habit";
}) {
  const [editing, setEditing] = useState(false);

  // Committed plus live, never one or the other: the roll-up is only written
  // by `endSession`, so mid-session the day's true total exists nowhere but
  // here. See the note on `committedSeconds` for why the server can't include
  // it.
  const total = log.committedSeconds + (live ? liveSeconds : 0);

  if (total === 0 && log.sessions.length === 0) {
    return (
      <p className="text-muted-foreground mt-6 text-center text-label">
        Nothing logged on this today yet.
      </p>
    );
  }

  return (
    <section className="mt-6 w-full max-w-sm text-center">
      <p className="text-muted-foreground text-label">
        <span
          className={cn("tabular-nums", live && "text-running font-medium")}
        >
          {formatDuration(total)}
        </span>{" "}
        {unit === "habit" ? "toward today's habit" : "logged today"}
        {live && log.committedSeconds > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · {formatDuration(log.committedSeconds)} before this session
          </span>
        )}
      </p>

      {log.sessions.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground mt-1 h-auto py-1 text-label font-normal underline underline-offset-4"
            onClick={() => setEditing((open) => !open)}
            aria-expanded={editing}
          >
            {editing ? "Done" : "Fix today's times"}
          </Button>

          {editing && (
            <div className="mt-2 text-left">
              {/* The day's total is a roll-up, so it is not the editable
                  object — the sessions under it are. Editing the total
                  directly would have to guess which session was wrong, and on
                  the day this matters most (one runaway session among several
                  good ones) it would guess wrong. */}
              <SessionLog sessions={log.sessions} />

              {live && (
                <p className="text-muted-foreground mt-2 text-micro">
                  The session on the clock isn&apos;t here yet — stop it first
                  and it becomes editable.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
