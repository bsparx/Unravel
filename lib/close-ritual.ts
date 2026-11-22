/**
 * The close — step sequencing, kept pure so the route can stay dumb.
 *
 * The step lives in the URL rather than in state, so the back button works, a
 * refresh doesn't restart the ritual, and a notification can deep-link
 * straight to a step.
 */

export const CLOSE_STEPS = [
  "summary",
  "one-thing",
  "worry",
  "handoff",
] as const;

export type CloseStep = (typeof CLOSE_STEPS)[number];

/** Active steps for the user: `summary` leads when Ending Summary is enabled. */
export function closeSteps(includeSummary = false): readonly CloseStep[] {
  return includeSummary
    ? CLOSE_STEPS
    : ["one-thing", "worry", "handoff"];
}

/** Never throws. A malformed ?step= starts the ritual rather than breaking it. */
export function parseCloseStep(
  raw: unknown,
  includeSummary = false,
): CloseStep {
  const steps = closeSteps(includeSummary);
  return typeof raw === "string" && steps.includes(raw as CloseStep)
    ? (raw as CloseStep)
    : steps[0];
}

/** The next step, or null at the end. */
export function nextCloseStep(
  step: CloseStep,
  includeSummary = false,
): CloseStep | null {
  const steps = closeSteps(includeSummary);
  const index = steps.indexOf(step);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
}

export function closeStepHref(step: CloseStep): string {
  return `/close?step=${step}`;
}
