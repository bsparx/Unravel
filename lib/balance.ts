/**
 * Work / recovery balance — pure functions.
 *
 * Both return `null` rather than lying. A ratio over zero is not zero, and
 * "no recovery at all" is not infinity: the honest rendering of both is
 * "there isn't a number yet", and the UI says so in words.
 */

/** Recovery as a share of all logged time, 0..1. Null when nothing was logged. */
export function recoveryShare(
  workSeconds: number,
  recoverySeconds: number,
): number | null {
  const total = workSeconds + recoverySeconds;
  if (total <= 0) return null;
  return recoverySeconds / total;
}

/** Hours of work per hour of recovery. Null when there was no recovery. */
export function balanceRatio(
  workSeconds: number,
  recoverySeconds: number,
): number | null {
  if (recoverySeconds <= 0) return null;
  if (workSeconds <= 0) return 0;
  return workSeconds / recoverySeconds;
}

/** The sentence under the balance panel. */
export function describeBalance(
  workSeconds: number,
  recoverySeconds: number,
): string {
  const ratio = balanceRatio(workSeconds, recoverySeconds);

  if (ratio === null) {
    return workSeconds > 0
      ? "You haven't logged any recovery yet. It counts the same as work here."
      : "Nothing logged yet.";
  }

  if (ratio === 0) {
    return "All recovery and no work logged. That's allowed.";
  }

  if (ratio < 1) {
    const inverse = (1 / ratio).toFixed(1);
    return `For every hour of work you logged ${inverse} hours of recovery.`;
  }

  return `For every hour of recovery you logged ${ratio.toFixed(1)} hours of work.`;
}
