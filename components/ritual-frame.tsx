"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The shell both Mind rituals share: a full-bleed sky made of stacked layers
 * that cross-fade as you move through the steps, a letter rail down the side,
 * a header, the step body and a frosted footer.
 *
 * Each ritual tells its own weather story through the sky (WOOP goes from
 * night to sunrise, ABCDE from storm to clear) but the structure is one
 * thing, so the two read as the same instrument with different music.
 *
 * Presentational only. The ritual owns its steps, state and save.
 */

export type RitualSky = {
  key: string;
  /** The layer's background class, defined in globals.css. */
  className: string;
  /** Extra scenery for this sky (sun, clouds, rain). */
  scenery?: ReactNode;
};

export type RitualRailStep = {
  key: string;
  letter: string;
  name: string;
  /** Text colour class for the current letter. */
  accent: string;
  done: boolean;
  current: boolean;
  reachable: boolean;
};

export function RitualFrame({
  label,
  eyebrow,
  title,
  skies,
  skyKey,
  steps,
  onJump,
  locked = false,
  announce,
  aside,
  footer,
  onDismiss,
  children,
}: {
  /** What the rail is, for screen readers ("WOOP steps"). */
  label: string;
  eyebrow: string;
  title: string;
  skies: readonly RitualSky[];
  /** Which sky is up. */
  skyKey: string;
  steps: readonly RitualRailStep[];
  onJump: (index: number) => void;
  /** A save is in flight: the rail and dismissal hold still. */
  locked?: boolean;
  /** Read out on each step change. */
  announce: string;
  /** Top-right of the page: a chip, a hint. */
  aside?: ReactNode;
  footer: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && !locked && onDismiss()}>
      <DialogContent
        showCloseButton={false}
        className="isolate flex h-[min(680px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden border-0 bg-[var(--woop-base)] p-0 text-[var(--woop-ink)] ring-[var(--woop-line)] sm:max-w-3xl"
      >
        {/* The sky: one layer per step, cross-faded. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {skies.map((sky) => (
            <div
              key={sky.key}
              className={cn(
                "absolute inset-0 transition-opacity duration-1000 ease-out",
                sky.className,
                skyKey === sky.key ? "opacity-100" : "opacity-0",
              )}
            >
              {skyKey === sky.key && sky.scenery}
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--woop-line)] to-transparent" />
        </div>

        {/* Fixed height, and only the step body scrolls: the dialog clips
            its corners with overflow-hidden, so anything that grew past the
            screen (a long card, a phone keyboard) used to push the footer out
            of reach. The footer is pinned instead. */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label={label}
            className="flex shrink-0 justify-center gap-4 border-b border-[var(--woop-line)] px-4 pt-5 pb-3 sm:w-28 sm:flex-col sm:justify-center sm:gap-5 sm:border-r sm:border-b-0 sm:px-0 sm:py-8"
          >
            {steps.map((step, index) => (
              <button
                key={step.key}
                type="button"
                disabled={locked || !step.reachable}
                onClick={() => onJump(index)}
                aria-current={step.current ? "step" : undefined}
                aria-label={`${step.name}${step.done ? ", written" : ""}`}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1 transition-colors duration-500 focus-visible:ring-2 focus-visible:ring-[var(--woop-focus)] focus-visible:outline-none disabled:cursor-default",
                  step.current
                    ? cn(
                        step.accent,
                        "after:absolute after:-bottom-1 after:h-0.5 after:w-5 after:rounded-full after:bg-current sm:after:top-1/2 sm:after:bottom-auto sm:after:-left-3 sm:after:h-5 sm:after:w-0.5 sm:after:-translate-y-1/2",
                      )
                    : step.done
                      ? "text-[var(--woop-ink)]/85 hover:text-[var(--woop-ink)]"
                      : "text-[var(--woop-ink)]/30",
                )}
              >
                <span className="font-display text-3xl leading-none font-medium sm:text-[2.75rem]">
                  {step.letter}
                </span>
                <span className="hidden text-[0.625rem] font-medium tracking-[0.16em] uppercase opacity-80 sm:block">
                  {step.name}
                </span>
                {step.done && (
                  <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[var(--woop-ink)] text-[var(--woop-on-ink)]">
                    <Check className="size-2.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col px-5 pt-5 sm:px-8 sm:pt-8">
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-medium tracking-[0.2em] text-[var(--woop-ink-muted)] uppercase">
                  {eyebrow}
                </p>
                <DialogTitle className="font-display mt-1 truncate text-lg font-normal text-[var(--woop-ink)] sm:text-xl">
                  {title}
                </DialogTitle>
              </div>
              {aside}
            </div>

            <p className="sr-only" aria-live="polite">
              {announce}
            </p>

            {/* my-auto centres a short step and lets a long one scroll from
                its top, which justify-center would clip. */}
            <div className="-mx-5 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 sm:-mx-8 sm:px-8">
              <div className="my-auto py-6">{children}</div>
            </div>

            <div className="woop-glass -mx-5 flex shrink-0 items-center justify-between gap-2 border-t border-[var(--woop-line)] bg-[var(--woop-scrim)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-8 sm:px-8">
              {footer}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The step's question and its one line of method. */
export function RitualPrompt({
  question,
  guide,
}: {
  question: string;
  guide: string;
}) {
  return (
    <div className="space-y-1.5">
      <DialogDescription asChild>
        <h3 className="font-display pb-1 text-2xl leading-[1.15] text-balance text-[var(--woop-ink)] italic sm:text-[2rem]">
          {question}
        </h3>
      </DialogDescription>
      <p className="text-sm text-[var(--woop-ink-muted)]">{guide}</p>
    </div>
  );
}

/** The frosted card the writing happens on. */
export function RitualGlass({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "woop-glass rounded-2xl border border-[var(--woop-glass-edge)] bg-[var(--woop-glass)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_32px_-14px_rgba(3,5,20,0.6)] backdrop-blur-md sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** "24 / 120", turning warm past the limit. */
export function RitualCounter({
  length,
  max,
  hint,
}: {
  length: number;
  max: number;
  hint?: string;
}) {
  return (
    <p
      className={cn(
        "text-right font-mono text-[0.6875rem] tabular-nums text-[var(--woop-ink-muted)]",
        length > max && "text-[var(--woop-outcome)]",
      )}
    >
      {length} / {max}
      {hint && <span className="ml-3 hidden sm:inline">{hint}</span>}
    </p>
  );
}

/** The handwriting textarea every step writes into. */
export const ritualTextareaClass =
  "font-hand min-h-12 resize-none border-0 bg-transparent p-0 text-2xl leading-snug text-[var(--woop-ink)] shadow-none placeholder:text-[var(--woop-ink)]/55 focus-visible:ring-0 sm:text-3xl dark:bg-transparent";

/** Primary: a cream pill with an inner highlight. No glow. */
export const ritualPrimaryClass =
  "rounded-full bg-[var(--woop-ink)] px-5 text-[var(--woop-on-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_-8px_rgba(5,8,30,0.5)] transition-[transform,filter] hover:bg-[var(--woop-ink)] hover:brightness-110 active:scale-[0.98] disabled:bg-[var(--woop-glass)] disabled:text-[var(--woop-ink-muted)] disabled:shadow-none";

export const ritualGhostClass =
  "text-[var(--woop-ink-muted)] hover:bg-[var(--woop-hover)] hover:text-[var(--woop-ink)]";
