"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight, ListPlus } from "lucide-react";
import { toast } from "sonner";

import { TaskForm } from "@/app/(app)/tasks/_components/task-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFullDate, formatMinutes, parseLocalDate } from "@/lib/dates";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { createOneThing, selectOneThing } from "../actions";

export type PassOption = {
  kind: "task" | "capture";
  id: string;
  label: string;
  detail?: string;
};

/**
 * The morning pass.
 *
 * The only decision the app asks you to make all day, and it asks once. Shown
 * only while nothing is chosen; the moment you pick, it collapses to a single
 * card and the choosing UI is gone.
 *
 * Deliberately a short list, not the whole backlog — scrolling a hundred
 * things to find one is the state this screen exists to get you out of.
 */
export function MorningPass({
  options,
  dateISO,
  projects,
  heading = "What's the one thing?",
  hint = "Everything else can wait. You can always change it.",
}: {
  options: PassOption[];
  dateISO: string;
  projects: { id: string; name: string }[];
  heading?: string;
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState(
    selectOneThing,
    idleState,
  );
  const [typed, setTyped] = useState("");
  const [detailed, setDetailed] = useState(false);

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  // The full form is a different screen's worth of decisions, so it replaces
  // the pass rather than sitting under it. Two ways to submit the same thing,
  // both on screen at once, is a choice nobody asked to make.
  if (detailed) {
    const date = parseLocalDate(dateISO);

    return (
      <div className="w-full">
        <h1 className="font-display text-display text-balance">
          Set up the one thing
        </h1>
        <p className="text-muted-foreground mt-2 text-body">
          {date ? `Due ${formatFullDate(date)} — that's the point of it.` : null}{" "}
          Break it into steps so starting isn&apos;t a decision.
        </p>

        <div className="mt-8">
          <TaskForm
            kind="TODO"
            action={createOneThing}
            projects={projects}
            hidden={{ date: dateISO }}
            // The day is the deadline. Asking would be a question with one
            // possible answer.
            showDeadline={false}
            titleLabel="The one thing"
            values={{ title: typed }}
            submitLabel="Set it"
            cancelLabel="Never mind"
            onCancel={() => setDetailed(false)}
            // No redirect: the page re-renders into the card by itself once the
            // selection lands.
            onSuccess={() => setDetailed(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="font-display text-display text-balance">{heading}</h1>
      <p className="text-muted-foreground mt-2 text-body">{hint}</p>

      {options.length > 0 && (
        <ul className="mt-8 space-y-1.5">
          {options.map((option) => (
            <li key={`${option.kind}-${option.id}`}>
              <form action={formAction}>
                <input type="hidden" name="date" value={dateISO} />
                <input
                  type="hidden"
                  name={option.kind === "task" ? "taskId" : "captureId"}
                  value={option.id}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "group border-border hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body">
                      {option.label}
                    </span>
                    {option.detail && (
                      <span className="text-muted-foreground text-label">
                        {option.detail}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary size-4 shrink-0"
                    aria-hidden
                  />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-6 flex gap-2">
        <input type="hidden" name="date" value={dateISO} />
        <label htmlFor="one-thing-title" className="sr-only">
          Or type it
        </label>
        <Input
          id="one-thing-title"
          name="title"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={pending}
          maxLength={200}
          autoComplete="off"
          placeholder={
            options.length > 0 ? "Or something else entirely…" : "Type it here…"
          }
          className="h-11 text-body"
        />
        <Button type="submit" disabled={pending || typed.trim().length === 0}>
          Set it
        </Button>
      </form>

      {/* The way out for a one thing that's actually several moves. Quiet, and
          below the fast path, because most mornings the title is enough. */}
      <button
        type="button"
        onClick={() => setDetailed(true)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-3 inline-flex items-center gap-1.5 rounded text-label underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        <ListPlus className="size-4" aria-hidden />
        Add steps and an estimate
      </button>
    </div>
  );
}

/** Shared shape helper so the page and /close describe options identically. */
export function describeEstimate(estimatedSeconds: number | null): string | undefined {
  return estimatedSeconds ? formatMinutes(estimatedSeconds) : undefined;
}
