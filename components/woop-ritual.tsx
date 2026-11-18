"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, EyeClosed, Sparkle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMPTY_WOOP,
  WOOP_STEPS,
  woopClause,
  type WoopFields,
  type WoopKey,
} from "@/lib/woop";

import {
  RitualCounter,
  RitualFrame,
  RitualGlass,
  RitualPrompt,
  ritualGhostClass,
  ritualPrimaryClass,
  ritualTextareaClass,
  type RitualSky,
} from "./ritual-frame";
import { WaxSeal, WoopCard } from "./woop-card";

/** Each step's accent: the light the sky gives off at that hour. */
const ACCENT: Record<WoopKey, string> = {
  wish: "text-[var(--woop-wish)]",
  outcome: "text-[var(--woop-outcome)]",
  obstacle: "text-[var(--woop-obstacle)]",
  plan: "text-[var(--woop-plan)]",
};

const RING: Record<WoopKey, string> = {
  wish: "border-[var(--woop-wish)]",
  outcome: "border-[var(--woop-outcome)]",
  obstacle: "border-[var(--woop-obstacle)]",
  plan: "border-[var(--woop-plan)]",
};

/** Night with one star, pre-dawn, cloud in the way, sunrise. */
const SKIES: readonly RitualSky[] = [
  {
    key: "wish",
    className: "woop-sky-wish",
    scenery: (
      <Sparkle className="absolute top-[12%] right-[14%] size-4 fill-current text-[var(--woop-star)]" />
    ),
  },
  { key: "outcome", className: "woop-sky-outcome" },
  {
    key: "obstacle",
    className: "woop-sky-obstacle",
    scenery: <div className="woop-clouds absolute inset-0" />,
  },
  {
    key: "plan",
    className: "woop-sky-plan",
    scenery: (
      <div className="woop-rise absolute inset-x-0 -bottom-24 mx-auto size-48 rounded-full bg-[radial-gradient(circle,rgba(255,226,160,0.95),rgba(255,180,100,0.5)_45%,transparent_70%)] blur-sm" />
    ),
  },
];

type Phase = "write" | "picture" | "review";

/**
 * The WOOP ritual: Wish, Outcome, Obstacle, Plan, as one short walk from
 * night to sunrise.
 *
 * After the outcome and the obstacle it pauses and asks you to picture them.
 * That pause is the mental contrasting, and it's what separates the method
 * from a form with four boxes. A wish ends sealed, with wax.
 *
 * Presentational: the caller owns the save. `onSeal` resolves true once the
 * wish is stored; until then the card holds still under its seal.
 */
export function WoopRitual({
  initial,
  onSeal,
  onCancel,
}: {
  /** An existing wish to rewrite. Opens straight on its card. */
  initial?: WoopFields | null;
  onSeal: (fields: WoopFields) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<WoopFields>(initial ?? EMPTY_WOOP);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(initial ? "review" : "write");
  const [sealing, setSealing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const step = WOOP_STEPS[index];
  const trimmed = fields[step.key].trim();
  const stepValid = trimmed.length > 0 && trimmed.length <= step.max;

  // Every new step hands the pen straight back.
  useEffect(() => {
    if (phase !== "write") return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [index, phase]);

  const firstEmpty = WOOP_STEPS.findIndex((s) => !fields[s.key].trim());
  const reachable = (i: number) => firstEmpty === -1 || i <= firstEmpty;

  const nextStep = () => {
    if (index < WOOP_STEPS.length - 1) {
      setIndex(index + 1);
      setPhase("write");
    } else {
      setPhase("review");
    }
  };

  const advance = () => {
    if (!stepValid) return;
    if (phase === "write" && step.picture) setPhase("picture");
    else nextStep();
  };

  const back = () => {
    if (phase === "review") {
      setIndex(WOOP_STEPS.length - 1);
      setPhase("write");
    } else if (phase === "picture") {
      setPhase("write");
    } else if (index > 0) {
      setIndex(index - 1);
    }
  };

  const seal = async () => {
    if (sealing) return;
    setSealing(true);
    // The stamp needs a beat to land; the save rarely does. Waiting for both
    // means the card is never yanked away mid-stamp.
    const [ok] = await Promise.all([
      onSeal({
        wish: fields.wish.trim(),
        outcome: fields.outcome.trim(),
        obstacle: fields.obstacle.trim(),
        plan: fields.plan.trim(),
      }),
      new Promise((resolve) => window.setTimeout(resolve, 1100)),
    ]);
    if (!ok) setSealing(false);
  };

  return (
    <RitualFrame
      label="WOOP steps"
      eyebrow="WOOP"
      title={initial ? "Your wish" : "A new wish"}
      skies={SKIES}
      skyKey={phase === "review" ? "plan" : step.key}
      locked={sealing}
      onDismiss={onCancel}
      announce={phase === "review" ? "Your WOOP, ready to seal" : `Step ${index + 1} of 4, ${step.name}`}
      steps={WOOP_STEPS.map((s, i) => ({
        key: s.key,
        letter: s.letter,
        name: s.name,
        accent: ACCENT[s.key],
        done: Boolean(fields[s.key].trim()) && (i < index || phase === "review"),
        current: phase !== "review" && i === index,
        reachable: reachable(i),
      }))}
      onJump={(i) => {
        setIndex(i);
        setPhase("write");
      }}
      footer={
        <>
          {index === 0 && phase === "write" ? (
            <Button type="button" variant="ghost" onClick={onCancel} className={ritualGhostClass}>
              Not now
            </Button>
          ) : (
            <Button type="button" variant="ghost" disabled={sealing} onClick={back} className={ritualGhostClass}>
              <ArrowLeft className="size-4" aria-hidden />
              {phase === "review" ? "Edit" : "Back"}
            </Button>
          )}

          {phase === "write" && (
            <Button type="button" disabled={!stepValid} onClick={advance} className={ritualPrimaryClass}>
              {step.picture ? "Picture it" : index === WOOP_STEPS.length - 1 ? "See the card" : "Next"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}

          {phase === "picture" && (
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" onClick={nextStep} className={ritualGhostClass}>
                Skip
              </Button>
              <Button type="button" autoFocus onClick={nextStep} className={ritualPrimaryClass}>
                I&apos;ve pictured it
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          )}

          {phase === "review" && (
            <Button
              type="button"
              autoFocus
              loading={sealing}
              disabled={sealing}
              onClick={() => void seal()}
              className="rounded-full bg-[var(--woop-plan)] px-6 font-medium text-[var(--woop-plan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_18px_-8px_rgba(60,30,5,0.6)] transition-transform hover:bg-[var(--woop-plan)] hover:brightness-105 active:scale-[0.98]"
            >
              {sealing ? "Sealing…" : initial ? "Seal it again" : "Seal it"}
            </Button>
          )}
        </>
      }
    >
      {phase === "write" && (
        <div key={`write-${step.key}`} className="woop-step-in space-y-4">
          <RitualPrompt question={step.question} guide={step.guide} />

          {step.key === "plan" && fields.obstacle.trim() && (
            <p className="font-hand text-2xl leading-snug text-[var(--woop-ink)]/80">
              If {woopClause(fields.obstacle)},
            </p>
          )}

          <RitualGlass>
            <div className="flex items-baseline gap-2">
              {step.key === "plan" && (
                <span className={cn("font-hand shrink-0 text-2xl sm:text-3xl", ACCENT.plan)}>
                  then I will
                </span>
              )}
              <Textarea
                ref={textareaRef}
                rows={step.key === "wish" ? 1 : 2}
                maxLength={step.max + 40}
                value={fields[step.key]}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, [step.key]: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    advance();
                  }
                }}
                placeholder={step.placeholder}
                aria-label={step.question}
                className={ritualTextareaClass}
              />
            </div>
          </RitualGlass>
          <RitualCounter length={trimmed.length} max={step.max} hint="Enter to continue" />
        </div>
      )}

      {phase === "picture" && step.picture && (
        <div key={`picture-${step.key}`} className="woop-step-in flex flex-col items-center gap-6 text-center">
          <div className="relative grid size-40 place-items-center sm:size-48">
            <span className={cn("woop-breathe absolute inset-0 rounded-full border-2 opacity-70", RING[step.key])} />
            <span className={cn("woop-breathe absolute inset-5 rounded-full border opacity-40 [animation-delay:-2s]", RING[step.key])} />
            <span className={cn("absolute inset-12 rounded-full bg-current opacity-15 blur-xl", ACCENT[step.key])} />
            {/* No echo of what was just written: it's fresh in mind, and a long
                outcome never fit the ring. Back shows it if needed. */}
            <EyeClosed
              aria-hidden
              strokeWidth={1.5}
              className={cn("woop-breathe relative size-12 sm:size-14", ACCENT[step.key])}
            />
          </div>
          <div className="space-y-1">
            <p className="font-display text-xl text-[var(--woop-ink)] italic sm:text-2xl">{step.picture}</p>
            <p className="text-sm text-[var(--woop-ink-muted)]">
              Breathe with the ring. Take as long as it takes.
            </p>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="woop-card-in relative mx-auto w-full max-w-md">
          <WoopCard woop={fields} layout="stacked" />
          {sealing && <WaxSeal className="-right-3 -bottom-5" />}
        </div>
      )}
    </RitualFrame>
  );
}
