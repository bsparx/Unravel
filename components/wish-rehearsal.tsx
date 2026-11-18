"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, EyeClosed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { woopClause, type WoopFields, type WoopKey } from "@/lib/woop";

import { RitualFrame, ritualGhostClass, ritualPrimaryClass } from "./ritual-frame";
import { ACCENT, RING, SKIES } from "./woop-ritual";

type Beat = {
  key: Extract<WoopKey, "outcome" | "obstacle" | "plan">;
  letter: string;
  name: string;
  prompt: string;
  done: string;
};

const BEATS: readonly Beat[] = [
  {
    key: "outcome",
    letter: "O",
    name: "Outcome",
    prompt: "Close your eyes. Let the best of it play for a moment.",
    done: "I've pictured it",
  },
  {
    key: "obstacle",
    letter: "O",
    name: "Obstacle",
    prompt: "Now the moment it usually slips. See it as it is.",
    done: "I see it",
  },
  {
    key: "plan",
    letter: "P",
    name: "Plan",
    prompt: "Say it to yourself, once, as if it were already decided.",
    done: "Rehearsed",
  },
];

/**
 * A wish, rehearsed: the daily form of WOOP. The wish is already written, so
 * this is three short beats over the same skies: picture the outcome, see the
 * obstacle, say the if-then. Doing it once a day is what keeps the summit.
 *
 * Presentational: the caller saves. `onDone` resolves true once the day is
 * stored, and the frame holds still until then.
 */
export function WishRehearsal({
  woop,
  onDone,
  onCancel,
}: {
  woop: WoopFields;
  onDone: () => Promise<boolean>;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const beat = BEATS[index];
  const last = index === BEATS.length - 1;

  const next = async () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    const ok = await onDone();
    if (!ok) setSaving(false);
  };

  return (
    <RitualFrame
      label="Rehearsal steps"
      eyebrow="Rehearse"
      title={woop.wish}
      skies={SKIES}
      skyKey={beat.key}
      locked={saving}
      onDismiss={onCancel}
      announce={`Step ${index + 1} of 3, ${beat.name}`}
      steps={BEATS.map((b, i) => ({
        key: b.key,
        letter: b.letter,
        name: b.name,
        accent: ACCENT[b.key],
        done: i < index,
        current: i === index,
        reachable: i <= index,
      }))}
      onJump={(i) => setIndex(i)}
      footer={
        <>
          {index === 0 ? (
            <Button type="button" variant="ghost" onClick={onCancel} className={ritualGhostClass}>
              Not now
            </Button>
          ) : (
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setIndex(index - 1)} className={ritualGhostClass}>
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Button>
          )}
          <Button
            type="button"
            autoFocus
            loading={saving}
            disabled={saving}
            onClick={() => void next()}
            className={
              last
                ? "rounded-full bg-[var(--woop-plan)] px-6 font-medium text-[var(--woop-plan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_18px_-8px_rgba(60,30,5,0.6)] transition-transform hover:bg-[var(--woop-plan)] hover:brightness-105 active:scale-[0.98]"
                : ritualPrimaryClass
            }
          >
            {saving ? "Keeping it…" : beat.done}
            {!last && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </>
      }
    >
      <div key={beat.key} className="woop-step-in flex flex-col items-center gap-6 text-center">
        {beat.key === "plan" ? (
          <p className="font-display max-w-xl text-2xl leading-snug text-balance text-[var(--woop-ink)] sm:text-3xl">
            <span className="text-[var(--woop-ink-muted)]">If {woopClause(woop.obstacle)},</span>{" "}
            <span className={ACCENT.plan}>then I will</span> {woopClause(woop.plan)}.
          </p>
        ) : (
          <>
            <div className="relative grid size-32 place-items-center sm:size-40">
              <span className={cn("woop-breathe absolute inset-0 rounded-full border-2 opacity-70", RING[beat.key])} />
              <span className={cn("woop-breathe absolute inset-5 rounded-full border opacity-40 [animation-delay:-2s]", RING[beat.key])} />
              <span className={cn("absolute inset-10 rounded-full bg-current opacity-15 blur-xl", ACCENT[beat.key])} />
              <EyeClosed aria-hidden strokeWidth={1.5} className={cn("woop-breathe relative size-10 sm:size-12", ACCENT[beat.key])} />
            </div>
            <p className="font-display max-w-xl text-xl leading-snug text-balance text-[var(--woop-ink)] italic sm:text-2xl">
              {woop[beat.key]}
            </p>
          </>
        )}
        <p className="text-sm text-[var(--woop-ink-muted)]">{beat.prompt}</p>
      </div>
    </RitualFrame>
  );
}
