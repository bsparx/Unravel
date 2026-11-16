"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Wind } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ABCDE_STEPS,
  DISPUTATION_MAX,
  DISPUTE_LENSES,
  EMPTY_DISPUTATION,
  hasDispute,
  type AbcdeKey,
  type DisputationFields,
  type DisputeLens,
} from "@/lib/disputation";

import { DisputationIndexCard } from "./disputation-card";
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

const ACCENT: Record<AbcdeKey, string> = {
  adversity: "text-[var(--abcde-adversity)]",
  belief: "text-[var(--abcde-belief)]",
  consequences: "text-[var(--abcde-consequences)]",
  disputation: "text-[var(--abcde-disputation)]",
  energization: "text-[var(--abcde-energization)]",
};

/** Dusk, low cloud, rain, wind tearing it open, the washed sky after. */
const SKIES: readonly RitualSky[] = [
  { key: "adversity", className: "abcde-sky-adversity" },
  { key: "belief", className: "abcde-sky-belief" },
  {
    key: "consequences",
    className: "abcde-sky-consequences",
    scenery: <div className="abcde-rain absolute inset-0" />,
  },
  {
    key: "disputation",
    className: "abcde-sky-disputation",
    scenery: <div className="abcde-wind absolute inset-0" />,
  },
  { key: "energization", className: "abcde-sky-energization" },
];

type TextKey = "adversity" | "belief" | "consequences" | "energization";

const TEXT_MAX: Record<TextKey, number> = {
  adversity: DISPUTATION_MAX.adversity,
  belief: DISPUTATION_MAX.belief,
  consequences: DISPUTATION_MAX.consequences,
  energization: DISPUTATION_MAX.energization,
};

/** One step's answer is in, and inside its clamp. */
function stepComplete(key: AbcdeKey, fields: DisputationFields): boolean {
  if (key === "disputation") {
    return (
      hasDispute(fields) &&
      DISPUTE_LENSES.every((lens) => fields[lens.key].trim().length <= DISPUTATION_MAX.lens)
    );
  }
  const value = fields[key].trim();
  return value.length > 0 && value.length <= TEXT_MAX[key];
}

/**
 * The ABCDE ritual, after Seligman: Adversity, Belief, Consequences,
 * Disputation, Energization, walked as weather — a grey dusk, cloud pressing
 * low, the rain, wind tearing it open, and the washed sky after.
 *
 * D is the heart of it. The belief is quoted back in your own hand, and four
 * lenses offer four ways to argue with it; one is enough. B and E each carry
 * an optional 0-10 rating, so the card can show how far the belief moved.
 *
 * Presentational: `onSave` resolves true once the entry is stored.
 */
export function DisputationRitual({
  initial,
  onSave,
  onCancel,
}: {
  initial?: DisputationFields | null;
  onSave: (fields: DisputationFields) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<DisputationFields>(initial ?? EMPTY_DISPUTATION);
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [openLens, setOpenLens] = useState<DisputeLens>("evidence");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const step = ABCDE_STEPS[index];
  const valid = stepComplete(step.key, fields);

  useEffect(() => {
    if (review) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [index, review, openLens]);

  const firstIncomplete = ABCDE_STEPS.findIndex((s) => !stepComplete(s.key, fields));
  const reachable = (i: number) => firstIncomplete === -1 || i <= firstIncomplete;

  const set = <K extends keyof DisputationFields>(key: K, value: DisputationFields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const advance = () => {
    if (!valid) return;
    if (index < ABCDE_STEPS.length - 1) setIndex(index + 1);
    else setReview(true);
  };

  const back = () => {
    if (review) {
      setReview(false);
      setIndex(ABCDE_STEPS.length - 1);
    } else if (index > 0) {
      setIndex(index - 1);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const trim = (value: string) => value.trim();
    const ok = await onSave({
      ...fields,
      adversity: trim(fields.adversity),
      belief: trim(fields.belief),
      consequences: trim(fields.consequences),
      evidence: trim(fields.evidence),
      alternatives: trim(fields.alternatives),
      implications: trim(fields.implications),
      usefulness: trim(fields.usefulness),
      energization: trim(fields.energization),
    });
    if (!ok) setSaving(false);
  };

  // Enter moves on from the one-box steps. In D there are four boxes and a
  // real argument often wants a second line, so Enter stays a newline there.
  const onEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && step.key !== "disputation") {
      event.preventDefault();
      advance();
    }
  };

  return (
    <RitualFrame
      label="ABCDE steps"
      eyebrow="Disputation"
      title={initial ? "Your disputation" : "Argue back"}
      skies={SKIES}
      skyKey={review ? "energization" : step.key}
      locked={saving}
      onDismiss={onCancel}
      announce={review ? "Your disputation, ready to keep" : `Step ${index + 1} of 5, ${step.name}`}
      steps={ABCDE_STEPS.map((s, i) => ({
        key: s.key,
        letter: s.letter,
        name: s.name,
        accent: ACCENT[s.key],
        done: stepComplete(s.key, fields) && (i < index || review),
        current: !review && i === index,
        reachable: reachable(i),
      }))}
      onJump={(i) => {
        setIndex(i);
        setReview(false);
      }}
      footer={
        <>
          {index === 0 && !review ? (
            <Button type="button" variant="ghost" onClick={onCancel} className={ritualGhostClass}>
              Not now
            </Button>
          ) : (
            <Button type="button" variant="ghost" disabled={saving} onClick={back} className={ritualGhostClass}>
              <ArrowLeft className="size-4" aria-hidden />
              {review ? "Edit" : "Back"}
            </Button>
          )}

          {review ? (
            <Button
              type="button"
              autoFocus
              loading={saving}
              disabled={saving}
              onClick={() => void save()}
              className={ritualPrimaryClass}
            >
              {saving ? "Keeping…" : "Keep it"}
            </Button>
          ) : (
            <Button type="button" disabled={!valid} onClick={advance} className={ritualPrimaryClass}>
              {index === ABCDE_STEPS.length - 1 ? "See the card" : "Next"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </>
      }
    >
      {!review && step.key !== "disputation" && (
        <div key={`write-${step.key}`} className="woop-step-in space-y-4">
          <RitualPrompt question={step.question} guide={step.guide} />
          <RitualGlass>
            <Textarea
              ref={textareaRef}
              rows={2}
              maxLength={TEXT_MAX[step.key as TextKey] + 40}
              value={fields[step.key as TextKey]}
              onChange={(event) => set(step.key as TextKey, event.target.value)}
              onKeyDown={onEnter}
              placeholder={step.placeholder}
              aria-label={step.question}
              className={ritualTextareaClass}
            />
          </RitualGlass>
          <RitualCounter
            length={fields[step.key as TextKey].trim().length}
            max={TEXT_MAX[step.key as TextKey]}
            hint="Enter to continue"
          />

          {step.key === "belief" && (
            <Conviction
              label="How strongly do you believe it, right now?"
              value={fields.beliefBefore}
              onChange={(value) => set("beliefBefore", value)}
            />
          )}
          {step.key === "energization" && (
            <Conviction
              label="And how strongly do you believe it now?"
              value={fields.beliefAfter}
              ghost={fields.beliefBefore}
              onChange={(value) => set("beliefAfter", value)}
            />
          )}
        </div>
      )}

      {!review && step.key === "disputation" && (
        <div key="write-disputation" className="woop-step-in space-y-4">
          <RitualPrompt question={step.question} guide={step.guide} />

          {/* The belief, quoted back in your own hand: you argue with
              something specific, not with a feeling. */}
          <blockquote className="font-hand border-l-2 border-[var(--abcde-disputation)]/60 pl-3 text-2xl leading-snug text-[var(--woop-ink)]/85">
            &ldquo;{fields.belief.trim()}&rdquo;
          </blockquote>

          <div className="space-y-2">
            {DISPUTE_LENSES.map((lens) => {
              const open = openLens === lens.key;
              const filled = fields[lens.key].trim().length > 0;
              return (
                <RitualGlass key={lens.key} className={cn("p-0 sm:p-0", !open && "bg-white/5")}>
                  <button
                    type="button"
                    onClick={() => setOpenLens(lens.key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none sm:px-4"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border text-[#1b1f45]",
                        filled
                          ? "border-transparent bg-[var(--abcde-disputation)]"
                          : "border-[var(--woop-glass-edge)]",
                      )}
                    >
                      {filled && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--woop-ink)]">{lens.name}</span>
                      {!open && (
                        <span className="block truncate text-xs text-[var(--woop-ink-muted)]">
                          {filled ? fields[lens.key] : lens.question}
                        </span>
                      )}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 sm:px-4">
                      <p className="mb-1.5 text-sm text-[var(--woop-ink-muted)] italic">{lens.question}</p>
                      <Textarea
                        ref={textareaRef}
                        rows={2}
                        maxLength={DISPUTATION_MAX.lens + 40}
                        value={fields[lens.key]}
                        onChange={(event) => set(lens.key, event.target.value)}
                        placeholder={lens.placeholder}
                        aria-label={`${lens.name}: ${lens.question}`}
                        className={cn(ritualTextareaClass, "text-xl sm:text-2xl")}
                      />
                    </div>
                  )}
                </RitualGlass>
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-[var(--woop-ink-muted)]">
            <Wind className="size-3.5" aria-hidden />
            One lens is enough. The more honest, the better it works.
          </p>
        </div>
      )}

      {review && (
        <div className="woop-card-in mx-auto w-full max-w-md">
          <DisputationIndexCard entry={fields} />
        </div>
      )}
    </RitualFrame>
  );
}

/**
 * 0 to 10, as eleven tappable numerals. Nothing selected means "not rated",
 * which is a fine answer. `ghost` marks an earlier rating for comparison.
 */
function Conviction({
  label,
  value,
  ghost = null,
  onChange,
}: {
  label: string;
  value: number | null;
  ghost?: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <fieldset className="space-y-2 pt-1">
      <legend className="flex w-full items-baseline justify-between gap-3 text-sm text-[var(--woop-ink)]">
        <span>{label}</span>
        <span className="text-xs text-[var(--woop-ink-muted)]">Optional</span>
      </legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, n) => {
          const selected = value === n;
          const wasBefore = ghost === n && !selected;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} out of 10${wasBefore ? ", your earlier rating" : ""}`}
              onClick={() => onChange(selected ? null : n)}
              className={cn(
                "grid size-8 place-items-center rounded-full font-mono text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:size-9",
                selected
                  ? "bg-[var(--woop-ink)] text-[#161a3d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                  : wasBefore
                    ? "border border-dashed border-[var(--woop-ink)]/70 text-[var(--woop-ink)]"
                    : "bg-white/8 text-[var(--woop-ink)]/80 hover:bg-white/15",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {ghost !== null && (
        <p className="text-xs text-[var(--woop-ink-muted)]">
          The dashed ring is where you started: {ghost}.
        </p>
      )}
    </fieldset>
  );
}
