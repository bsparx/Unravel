import Link from "next/link";
import { Check, Moon } from "lucide-react";

import { StepList } from "@/components/step-list";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/dates";
import type { DayLogWithSelection } from "@/lib/day-log";
import { buildTimerHref, RECOVERY_HREF } from "@/lib/timer-url";
import { nextStep, stepProgress } from "@/lib/steps";
import { toWorkMode } from "@/lib/timer-math";

import { clearOneThing } from "../actions";
import { FrogPondLazy } from "./frog-pond-lazy";

/**
 * One card, one button.
 *
 * Everything the rest of the app can do is deliberately absent here: no
 * counts, no "3 overdue", no list, no calendar. If you want any of that it's
 * one tap away at /day. This screen has exactly one job.
 */
export function OneThingCard({
  dayLog,
  dateISO,
}: {
  dayLog: DayLogWithSelection;
  dateISO: string;
}) {
  const task = dayLog.selectedTask;
  if (!task) return null;

  const done = task.completedAt !== null;
  const steps = task.steps ?? [];
  const upNext = nextStep(steps);
  const progress = stepProgress(steps);

  return (
    <div className="w-full">
      <FrogPondLazy mood={done ? "eaten" : "chosen"} />

      <p className="text-micro text-muted-foreground mt-6 font-medium tracking-wider uppercase">
        {done ? "Today's frog — eaten" : "Today, the frog is"}
      </p>

      <h1 className="font-display mt-3 text-display text-balance">
        {task.title}
      </h1>

      {task.estimatedSeconds ? (
        <p className="text-muted-foreground mt-3 text-body tabular-nums">
          You gave it {formatMinutes(task.estimatedSeconds)}.
        </p>
      ) : null}

      {upNext && !done && (
        // The frog, reduced to the one move.
        //
        // Even a screen showing a single task can be too big to start — the
        // title is the whole scope of the thing. This is the only line on the
        // page that names something you could do in the next two minutes, so
        // it gets the emphasis and the title becomes context.
        <div className="border-primary/40 bg-accent/40 mt-6 rounded-lg border-l-2 py-3 pr-4 pl-4">
          <p className="text-micro text-primary font-medium tracking-wider uppercase">
            Start with
          </p>
          <p className="mt-1 text-body">
            {upNext.title}
            {upNext.estimatedSeconds ? (
              <span className="text-muted-foreground ml-2 tabular-nums">
                {formatMinutes(upNext.estimatedSeconds)}
              </span>
            ) : null}
          </p>
        </div>
      )}

      {steps.length > 1 && (
        <details className="group mt-3">
          <summary className="text-muted-foreground hover:text-foreground marker:content-none cursor-pointer list-none text-label underline underline-offset-4">
            {progress.done > 0
              ? `The rest of it — ${progress.done} of ${progress.total} done`
              : `The rest of it — ${progress.total} steps`}
          </summary>
          <div className="mt-2">
            <StepList steps={steps} />
          </div>
        </details>
      )}

      {task.notes && (
        <p className="text-muted-foreground mt-3 max-w-prose text-body whitespace-pre-wrap">
          {task.notes}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        {done ? (
          <>
            <p className="text-primary inline-flex items-center gap-2 text-body">
              <Check className="size-4" aria-hidden />
              That was the frog. Nothing else is required.
            </p>
            <Button asChild variant="outline">
              <Link href={RECOVERY_HREF}>
                <Moon className="size-4" aria-hidden />
                Take some recovery
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild size="lg">
            <Link
              href={buildTimerHref({
                id: task.id,
                estimatedSeconds: task.estimatedSeconds,
                defaultMode: toWorkMode(task.defaultMode),
                plannedIntervals: task.plannedIntervals,
              })}
            >
              Eat the frog
            </Link>
          </Button>
        )}

        <form action={clearOneThing}>
          <input type="hidden" name="date" value={dateISO} />
          <Button type="submit" variant="ghost" size="sm">
            Something else
          </Button>
        </form>
      </div>
    </div>
  );
}
