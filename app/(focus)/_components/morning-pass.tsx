"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/dates";
import { idleState } from "@/lib/validation";
import { cn } from "@/lib/utils";

import { selectOneThing } from "../actions";

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
  heading = "What's the one thing?",
  hint = "Everything else can wait. You can always change it.",
}: {
  options: PassOption[];
  dateISO: string;
  heading?: string;
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState(
    selectOneThing,
    idleState,
  );
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

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
    </div>
  );
}

/** Shared shape helper so the page and /close describe options identically. */
export function describeEstimate(estimatedSeconds: number | null): string | undefined {
  return estimatedSeconds ? formatMinutes(estimatedSeconds) : undefined;
}
