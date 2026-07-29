/**
 * Steps — pure logic. No React, no Prisma.
 *
 * The premise: for the people this app is for, the expensive part of a task is
 * not doing it, it's *starting* it. A task called "Do the taxes" has no
 * surface you can grab. So a task can be broken into an ordered list of steps,
 * and the one at position 0 is treated differently everywhere — it's the one
 * the UI asks you to make trivially small, and the one it shows you instead of
 * the task title when you're deciding whether to begin.
 *
 * The rest of the list exists mostly so the first line is allowed to be small.
 */

export type StepLike = {
  id: string;
  title: string;
  position: number;
  estimatedSeconds: number | null;
  completedAt: Date | null;
};

/**
 * The ceiling for a first step, in seconds.
 *
 * Two minutes, not five. The number is chosen to be almost insultingly low,
 * because a first step you can talk yourself out of isn't doing its job — and
 * "open the file" genuinely does take under two minutes.
 */
export const EASY_FIRST_STEP_SECONDS = 120;

/** Ordered, defensively — never trust the caller sorted them. */
export const inOrder = <T extends StepLike>(steps: T[]): T[] =>
  [...steps].sort((a, b) => a.position - b.position);

/**
 * The step the task *starts* with. Always position 0, even once it's ticked —
 * this is "what did you decide the way in was", not "what's left".
 */
export const firstStep = <T extends StepLike>(steps: T[]): T | null =>
  inOrder(steps)[0] ?? null;

/**
 * The step to actually do next: the first unticked one.
 *
 * Distinct from `firstStep` on purpose. Once you're three steps in, the thing
 * to put in front of you is step four — but the *design* question ("is the way
 * in small enough?") is still about step one.
 */
export const nextStep = <T extends StepLike>(steps: T[]): T | null =>
  inOrder(steps).find((step) => step.completedAt === null) ?? null;

export type StepProgress = {
  done: number;
  total: number;
  /** 0..1. Zero when there are no steps, rather than NaN. */
  ratio: number;
  allDone: boolean;
};

export function stepProgress(steps: StepLike[]): StepProgress {
  const total = steps.length;
  const done = steps.filter((step) => step.completedAt !== null).length;
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    allDone: total > 0 && done === total,
  };
}

/** Seconds accounted for by the steps, ignoring the ones with no estimate. */
export const stepsEstimatedSeconds = (steps: StepLike[]): number =>
  steps.reduce((sum, step) => sum + (step.estimatedSeconds ?? 0), 0);

/**
 * Is the way in small enough to be frictionless?
 *
 * `null` means "can't tell" — no estimate given — and callers must render that
 * as silence, not as a warning. Nagging someone about an unfilled optional
 * field is precisely the kind of thing that makes people stop opening an app.
 */
export function isGentleStart(step: StepLike | null): boolean | null {
  if (!step) return null;
  if (step.estimatedSeconds === null) return null;
  return step.estimatedSeconds <= EASY_FIRST_STEP_SECONDS;
}

/**
 * The line shown under the first step in the editor.
 *
 * Deliberately advice and never validation: a long first step is a smell, not
 * an error, and blocking the save over it would only teach people to type
 * "start" as step one to get past the form.
 */
export function firstStepAdvice(step: StepLike | null): string | null {
  const gentle = isGentleStart(step);
  if (gentle === null) return null;
  return gentle
    ? "That's small enough to just do. Good."
    : "That's still a chunk. What's the two-minute version of it — opening the file, finding the number, writing one bad sentence?";
}

/**
 * Placeholders for the step editor. The first one is doing real work: it shows
 * the *scale* expected of a first step, which no amount of label copy does.
 */
export const STEP_PLACEHOLDERS = [
  "Open the document and read the first line",
  "…then what?",
  "…and then?",
] as const;

export const stepPlaceholder = (index: number): string =>
  STEP_PLACEHOLDERS[Math.min(index, STEP_PLACEHOLDERS.length - 1)];
