"use client";

import { Minus, Plus } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEPTHS,
  PRACTICE_MAX_COUNT,
  PRACTICE_MIN_COUNT,
  PRACTICE_TEMPLATES,
  clampCount,
  type Depth,
  type PracticeKind,
} from "@/lib/practices";

export type TemplateChoice = { template: string; count: number };

/**
 * Choose how a daily page is shaped.
 *
 * Native radios inside labels, so arrow keys move between templates for
 * free. The counted template carries its own stepper, outside the label,
 * because a button inside a radio's label would be two controls pretending
 * to be one. Each card spells out its steps in a faint line, so you can see
 * what a template asks before choosing it, without opening anything.
 */
export function PracticeTemplatePicker({
  kind,
  value,
  onChange,
  disabled = false,
  className,
}: {
  kind: PracticeKind;
  value: TemplateChoice;
  onChange: (next: TemplateChoice) => void;
  disabled?: boolean;
  className?: string;
}) {
  const templates = PRACTICE_TEMPLATES[kind];
  const noun = kind === "gratitude" ? "good things" : "du'as";

  return (
    <div
      role="radiogroup"
      aria-label={kind === "gratitude" ? "Gratitude template" : "Du'a template"}
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {templates.map((template) => {
        const selected = value.template === template.id;
        const count = clampCount(value.count);
        const steps = template.steps(count);
        const outline = template.counted
          ? `${steps.length} ${steps.length === 1 ? noun.replace(/s$/, "") : noun}, one line each`
          : steps.map((step) => step.name).join(" · ");

        return (
          <div
            key={template.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-4 transition-colors",
              selected
                ? "border-primary/60 bg-primary/[0.06] shadow-[inset_0_0_0_1px_var(--color-primary)]"
                : "border-border bg-card hover:border-foreground/25",
              disabled && "opacity-60",
            )}
          >
            <label className="flex cursor-pointer flex-col gap-1.5">
              <input
                type="radio"
                name={`${kind}-template-choice`}
                value={template.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange({ template: template.id, count })}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:ring-ring pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2" />
              <span className="flex items-start justify-between gap-3">
                <span className="text-body font-medium">{template.name}</span>
                <DepthDots depth={template.depth} />
              </span>
              <span className="text-muted-foreground text-label">{template.blurb}</span>
              <span className="text-muted-foreground/80 text-micro mt-1 leading-relaxed">{outline}</span>
              <span className="text-muted-foreground font-mono text-micro tabular-nums">
                {steps.length} {steps.length === 1 ? "step" : "steps"} · about {template.minutes(count)} min
              </span>
            </label>

            {template.counted && (
              <CountStepper
                noun={noun}
                value={count}
                disabled={disabled}
                onChange={(next) => onChange({ template: template.id, count: next })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DepthDots({ depth }: { depth: Depth }) {
  const meta = DEPTHS[depth];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${meta.label}: ${meta.hint}`}
          className="focus-visible:ring-ring mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={cn(
                "size-1.5 rounded-full",
                dot <= meta.dots ? "bg-primary" : "bg-muted-foreground/25",
              )}
            />
          ))}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {meta.label}. {meta.hint}
      </TooltipContent>
    </Tooltip>
  );
}

function CountStepper({
  noun,
  value,
  onChange,
  disabled,
}: {
  noun: string;
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  const button =
    "border-border hover:bg-muted focus-visible:ring-ring grid size-8 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40";
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-dashed pt-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-label underline decoration-dotted underline-offset-4">
            How many
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          How many {noun} to write each day, 1 to {PRACTICE_MAX_COUNT}. Three is the classic.
        </TooltipContent>
      </Tooltip>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label={`Fewer ${noun}`}
          disabled={disabled || value <= PRACTICE_MIN_COUNT}
          onClick={() => onChange(value - 1)}
          className={button}
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <output aria-live="polite" className="font-display w-7 text-center text-xl tabular-nums">
          {value}
        </output>
        <button
          type="button"
          aria-label={`More ${noun}`}
          disabled={disabled || value >= PRACTICE_MAX_COUNT}
          onClick={() => onChange(value + 1)}
          className={button}
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
