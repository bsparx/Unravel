/**
 * The close — step sequencing, kept pure so the route can stay dumb.
 *
 * The step lives in the URL rather than in state, so the back button works, a
 * refresh doesn't restart the ritual, and a notification can deep-link
 * straight to a step.
 */

export const CLOSE_STEPS = [
  "one-thing",
  "worry",
  "handoff",
] as const;

export type CloseStep = (typeof CLOSE_STEPS)[number];

/** Never throws. A malformed ?step= starts the ritual rather than breaking it. */
export function parseCloseStep(raw: unknown): CloseStep {
  return typeof raw === "string" && CLOSE_STEPS.includes(raw as CloseStep)
    ? (raw as CloseStep)
    : CLOSE_STEPS[0];
}

/** The next step, or null at the end. */
export function nextCloseStep(step: CloseStep): CloseStep | null {
  const index = CLOSE_STEPS.indexOf(step);
  return index >= 0 && index < CLOSE_STEPS.length - 1
    ? CLOSE_STEPS[index + 1]
    : null;
}

export function closeStepHref(step: CloseStep): string {
  return `/close?step=${step}`;
}
