"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEPTHS,
  buildPracticeItems,
  fieldId,
  stepComplete,
  templateLabel,
  type PracticeKind,
  type PracticeTemplate,
} from "@/lib/practices";

import { DuaArch } from "./dua-arch";
import { GratitudePage } from "./gratitude-page";
import {
  RitualCounter,
  RitualFrame,
  RitualGlass,
  RitualPrompt,
  ritualGhostClass,
  ritualPrimaryClass,
  ritualTextareaClass,
  type RitualRailStep,
  type RitualSky,
} from "./ritual-frame";

type Flavour = {
  eyebrow: string;
  title: (editing: boolean) => string;
  label: string;
  accent: string;
  skies: readonly RitualSky[];
  /** Which sky is up, from 0 (first step) to 1 (last step); null on review. */
  sky: (progress: number | null) => string;
  save: string;
  saving: string;
  saveClass: string;
};

/**
 * Gratitude is lanterns: each good thing lights one on the rail, the sky
 * deepens from golden hour to dusk, and by the review the whole string is
 * lit. Du'a is the night: maghrib to the still hours, a crescent rising as
 * you write, a pale fajr on the review, and the save is "Ameen".
 */
const FLAVOURS: Record<PracticeKind, Flavour> = {
  gratitude: {
    eyebrow: "Gratitude",
    title: (editing) => (editing ? "Today's page" : "A page of good things"),
    label: "Gratitude steps",
    accent: "text-[var(--thanks-accent)]",
    skies: [
      { key: "early", className: "thanks-sky-early" },
      { key: "mid", className: "thanks-sky-mid" },
      { key: "late", className: "thanks-sky-late" },
      { key: "lit", className: "thanks-sky-lit" },
    ],
    sky: (p) => (p === null ? "lit" : p < 0.34 ? "early" : p < 0.67 ? "mid" : "late"),
    save: "Keep today's page",
    saving: "Keeping…",
    saveClass:
      "bg-[var(--thanks-accent)] text-[var(--thanks-on-accent)] hover:bg-[var(--thanks-accent)]",
  },
  dua: {
    eyebrow: "Du'a",
    title: (editing) => (editing ? "Today's du'a" : "A page of du'a"),
    label: "Du'a steps",
    accent: "text-[var(--dua-accent)]",
    skies: [
      { key: "maghrib", className: "dua-sky-maghrib" },
      { key: "isha", className: "dua-sky-isha" },
      { key: "night", className: "dua-sky-night" },
      { key: "fajr", className: "dua-sky-fajr" },
    ],
    sky: (p) => (p === null ? "fajr" : p < 0.34 ? "maghrib" : p < 0.67 ? "isha" : "night"),
    save: "Ameen",
    saving: "Ameen…",
    saveClass: "bg-[var(--dua-accent)] text-[var(--dua-on-accent)] hover:bg-[var(--dua-accent)]",
  },
};

type Phase = "write" | "review";

/**
 * One ritual for both daily pages, shaped by the template: one step per
 * screen, one or two answers per step, then the page itself on paper.
 *
 * Presentational: the caller owns the save. `onSave` resolves true once the
 * page is stored; until then the ritual holds still.
 */
export function PracticeRitual({
  kind,
  template,
  count,
  seed = 0,
  initial,
  onSave,
  onCancel,
}: {
  kind: PracticeKind;
  template: PracticeTemplate;
  count: number;
  seed?: number;
  /** Today's page, to rewrite. Opens straight on the page. */
  initial?: Record<string, string> | null;
  onSave: (answers: Record<string, string>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const flavour = FLAVOURS[kind];
  const steps = template.steps(count, seed);
  const [answers, setAnswers] = useState<Record<string, string>>(initial ?? {});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(initial ? "review" : "write");
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  const step = steps[index];
  const complete = stepComplete(step, answers);
  const isLast = index === steps.length - 1;
  const blankOptional =
    step.fields.every((field) => field.optional) &&
    step.fields.every((field) => !(answers[fieldId(step, field)] ?? "").trim());

  // Every new step hands the pen straight back.
  useEffect(() => {
    if (phase !== "write") return;
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [index, phase]);

  const firstIncomplete = steps.findIndex((s) => !stepComplete(s, answers));
  const reachable = (i: number) => firstIncomplete === -1 || i <= firstIncomplete;

  const advance = () => {
    if (!complete) return;
    if (isLast) setPhase("review");
    else setIndex(index + 1);
  };

  const back = () => {
    if (phase === "review") {
      setIndex(steps.length - 1);
      setPhase("write");
    } else if (index > 0) {
      setIndex(index - 1);
    }
  };

  const built = buildPracticeItems(template, count, answers);

  const save = async () => {
    if (saving || !built.ok) return;
    setSaving(true);
    // The lanterns need a beat to catch; the save rarely does.
    const [ok] = await Promise.all([
      onSave(answers),
      new Promise((resolve) => window.setTimeout(resolve, 1100)),
    ]);
    if (!ok) setSaving(false);
  };

  const progress = phase === "review" ? null : steps.length > 1 ? index / (steps.length - 1) : 0;
  const rail: RitualRailStep[] = steps.map((s, i) => ({
    key: s.key,
    letter: s.glyph,
    name: s.name,
    accent: flavour.accent,
    // A skipped optional step isn't "written": no check, no lit lantern.
    done:
      stepComplete(s, answers) &&
      s.fields.some((field) => (answers[fieldId(s, field)] ?? "").trim()) &&
      (i < index || phase === "review"),
    current: phase !== "review" && i === index,
    reachable: reachable(i),
  }));

  const depth = DEPTHS[template.depth];

  return (
    <RitualFrame
      label={flavour.label}
      eyebrow={flavour.eyebrow}
      title={flavour.title(Boolean(initial))}
      skies={flavour.skies}
      skyKey={flavour.sky(progress)}
      locked={saving}
      onDismiss={onCancel}
      announce={phase === "review" ? "Your page, ready to keep" : `Step ${index + 1} of ${steps.length}, ${step.name}`}
      steps={rail}
      onJump={(i) => {
        setIndex(i);
        setPhase("write");
      }}
      backdrop={
        kind === "dua" ? (
          <span
            className="dua-crescent absolute right-[6%] size-[1em] text-[2.25rem] sm:text-[3.5rem]"
            style={{
              bottom: progress === null ? "74%" : `${14 + progress * 52}%`,
              opacity: progress === null ? 0.35 : 0.95,
            }}
          />
        ) : null
      }
      renderGlyph={
        kind === "gratitude"
          ? (railStep) => {
              const dense = steps.length > 6;
              return (
                <>
                  <span
                    data-lit={railStep.done || saving ? "true" : "false"}
                    className={cn("thanks-lantern block", dense ? "h-5 w-3.5 sm:h-6 sm:w-4" : "h-7 w-5 sm:h-9 sm:w-6")}
                  />
                  <span
                    className={cn(
                      "mt-1 leading-none",
                      /\d/.test(railStep.letter) ? "font-mono text-[0.6875rem] tabular-nums" : "font-display text-sm",
                    )}
                  >
                    {railStep.letter}
                  </span>
                </>
              );
            }
          : undefined
      }
      aside={
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] px-3 py-1 text-[0.6875rem] font-medium text-[var(--woop-ink-muted)] backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none"
            >
              <span className="max-w-[9rem] truncate sm:max-w-none">{templateLabel(template, count)}</span>
              <span aria-hidden className="inline-flex gap-0.5">
                {[1, 2, 3].map((dot) => (
                  <span
                    key={dot}
                    className={cn(
                      "size-1 rounded-full",
                      dot <= depth.dots ? "bg-current" : "bg-current opacity-25",
                    )}
                  />
                ))}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64 flex-col items-start gap-1">
            <span>{template.blurb}</span>
            <span className="opacity-75">
              Change the template from the chip on the Mind page. Pages you&apos;ve written keep their own.
            </span>
          </TooltipContent>
        </Tooltip>
      }
      footer={
        <>
          {index === 0 && phase === "write" ? (
            <Button type="button" variant="ghost" onClick={onCancel} className={ritualGhostClass}>
              Not now
            </Button>
          ) : (
            <Button type="button" variant="ghost" disabled={saving} onClick={back} className={ritualGhostClass}>
              <ArrowLeft className="size-4" aria-hidden />
              {phase === "review" ? "Edit" : "Back"}
            </Button>
          )}

          {phase === "write" ? (
            <Button type="button" disabled={!complete} onClick={advance} className={ritualPrimaryClass}>
              {blankOptional ? "Skip" : isLast ? "See the page" : "Next"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              autoFocus
              loading={saving}
              disabled={saving || !built.ok}
              onClick={() => void save()}
              className={cn(
                "rounded-full px-6 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_18px_-8px_rgba(30,20,60,0.5)] transition-transform hover:brightness-105 active:scale-[0.98]",
                flavour.saveClass,
              )}
            >
              {saving ? flavour.saving : flavour.save}
            </Button>
          )}
        </>
      }
    >
      {phase === "write" && (
        <div key={`write-${step.key}`} className="woop-step-in space-y-4">
          <RitualPrompt question={step.question} guide={step.guide} />

          {step.fields.map((field, fieldIndex) => {
            const id = fieldId(step, field);
            const value = answers[id] ?? "";
            const multi = step.fields.length > 1;
            return (
              <div key={id} className="space-y-1.5">
                <RitualGlass>
                  {multi && (
                    <label
                      htmlFor={id}
                      className={cn("mb-1 block text-[0.6875rem] font-medium tracking-[0.14em] uppercase", flavour.accent)}
                    >
                      {field.label}
                      {field.optional && (
                        <span className="ml-2 tracking-normal text-[var(--woop-ink-muted)] normal-case">optional</span>
                      )}
                    </label>
                  )}
                  <Textarea
                    id={id}
                    ref={fieldIndex === 0 ? firstFieldRef : undefined}
                    rows={field.long ? 4 : field.max <= 80 ? 1 : 2}
                    maxLength={field.max + 40}
                    value={value}
                    onChange={(event) => setAnswers((prev) => ({ ...prev, [id]: event.target.value }))}
                    onKeyDown={(event) => {
                      // Short answers: Enter moves on. Long ones need their
                      // newlines, so it's Ctrl/Cmd+Enter there.
                      const submit = field.long ? event.metaKey || event.ctrlKey : !event.shiftKey;
                      if (event.key === "Enter" && submit) {
                        event.preventDefault();
                        if (fieldIndex < step.fields.length - 1) {
                          document.getElementById(fieldId(step, step.fields[fieldIndex + 1]))?.focus();
                        } else {
                          advance();
                        }
                      }
                    }}
                    placeholder={field.placeholder}
                    aria-label={multi ? undefined : step.question}
                    className={cn(ritualTextareaClass, field.long && "text-xl sm:text-2xl")}
                  />
                </RitualGlass>
                <RitualCounter
                  length={value.trim().length}
                  max={field.max}
                  hint={
                    fieldIndex === step.fields.length - 1
                      ? field.long
                        ? "Ctrl + Enter to continue"
                        : "Enter to continue"
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {phase === "review" && built.ok && (
        <div className="woop-card-in relative mx-auto w-full max-w-md">
          {kind === "gratitude" ? (
            <GratitudePage templateName={templateLabel(template, count)} items={built.items} />
          ) : (
            <DuaArch templateName={templateLabel(template, count)} items={built.items} />
          )}
        </div>
      )}
    </RitualFrame>
  );
}
