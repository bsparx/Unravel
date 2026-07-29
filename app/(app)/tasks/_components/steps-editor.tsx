"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EASY_FIRST_STEP_SECONDS,
  firstStepAdvice,
  isGentleStart,
  stepPlaceholder,
} from "@/lib/steps";
import { MAX_STEPS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export type StepDraft = {
  id?: string;
  title: string;
  estimateMinutes: number | null;
};

/**
 * Breaking a task down, with the first line treated as a different kind of
 * thing from the rest.
 *
 * The whole design rests on one claim: the reason a task doesn't get started
 * isn't that it's long, it's that it has no handle. So step one gets its own
 * label, its own framing, a placeholder that demonstrates the expected scale,
 * and a default estimate of two minutes. Steps two onwards are an ordinary
 * list, quieter, and entirely optional.
 *
 * The advice under step one is advice and never validation — see
 * `firstStepAdvice`. Blocking a save over it would just teach people to type
 * "begin" to get past the form.
 */
export function StepsEditor({
  name,
  defaultSteps = [],
}: {
  name: string;
  defaultSteps?: StepDraft[];
}) {
  const [steps, setSteps] = useState<StepDraft[]>(defaultSteps);

  const update = (index: number, patch: Partial<StepDraft>) =>
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );

  const remove = (index: number) =>
    setSteps((current) => current.filter((_, i) => i !== index));

  const move = (index: number, delta: number) =>
    setSteps((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const add = () =>
    setSteps((current) =>
      current.length >= MAX_STEPS
        ? current
        : [
            ...current,
            {
              title: "",
              // The first step defaults to the ceiling for "small enough to
              // just do". Every later step defaults to no estimate, because
              // guessing at step six is fiction.
              estimateMinutes:
                current.length === 0 ? EASY_FIRST_STEP_SECONDS / 60 : null,
            },
          ],
    );

  // Blank rows are dropped rather than rejected: an empty trailing step is
  // someone who pressed "add" and changed their mind, not an error.
  const payload = steps
    .filter((step) => step.title.trim().length > 0)
    .map((step) => ({
      ...(step.id ? { id: step.id } : {}),
      title: step.title.trim(),
      estimateMinutes: step.estimateMinutes,
    }));

  const first = steps[0];
  const advice = first
    ? firstStepAdvice({
        id: "draft",
        title: first.title,
        position: 0,
        estimatedSeconds: first.estimateMinutes
          ? first.estimateMinutes * 60
          : null,
        completedAt: null,
      })
    : null;
  const gentle =
    first &&
    isGentleStart({
      id: "draft",
      title: first.title,
      position: 0,
      estimatedSeconds: first.estimateMinutes ? first.estimateMinutes * 60 : null,
      completedAt: null,
    });

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(payload)} />

      {steps.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="border-border hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-ring group w-full rounded-lg border border-dashed px-4 py-5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 text-label font-medium">
            <Sparkles
              className="text-primary size-4 transition-transform group-hover:scale-110"
              aria-hidden
            />
            Break it into steps
          </span>
          <span className="text-muted-foreground mt-1 block text-label">
            Worth doing for anything you&apos;ve already put off once. The first
            step is the one that matters — make it small enough that there&apos;s
            nothing to dread.
          </span>
        </button>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const isFirst = index === 0;
            return (
              <li
                key={index}
                className={cn(
                  "rounded-lg border p-2.5 transition-colors",
                  isFirst
                    ? gentle
                      ? "border-primary/50 bg-accent/50"
                      : "border-primary/30 bg-accent/25"
                    : "border-border/70",
                )}
              >
                {isFirst && (
                  <p className="text-micro text-primary mb-1.5 flex items-center gap-1.5 font-medium tracking-wider uppercase">
                    <Sparkles className="size-3" aria-hidden />
                    The way in
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-micro tabular-nums",
                      isFirst
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {index + 1}
                  </span>

                  <Input
                    value={step.title}
                    onChange={(event) =>
                      update(index, { title: event.target.value })
                    }
                    maxLength={200}
                    placeholder={stepPlaceholder(index)}
                    aria-label={`Step ${index + 1}`}
                    className={cn("h-9 flex-1", isFirst && "font-medium")}
                  />

                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      value={step.estimateMinutes ?? ""}
                      onChange={(event) =>
                        update(index, {
                          estimateMinutes:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      placeholder="–"
                      aria-label={`Minutes for step ${index + 1}`}
                      className="h-9 w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground text-micro">min</span>
                  </div>

                  <div className="flex shrink-0">
                    <IconButton
                      label={`Move step ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Move step ${index + 1} down`}
                      disabled={index === steps.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Remove step ${index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>
                </div>

                {isFirst && advice && (
                  <p
                    className={cn(
                      "mt-1.5 pl-7 text-label",
                      gentle ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {advice}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {steps.length > 0 && steps.length < MAX_STEPS && (
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add a step
        </Button>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
