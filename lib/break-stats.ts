/**
 * What actually happens to breaks, as opposed to what was planned for them.
 *
 * Pure — no React, no Prisma — so `pnpm verify` covers it.
 *
 * This exists because the number is the intervention. Being told to take
 * shorter breaks does nothing; being shown that the five minutes you keep
 * choosing has averaged nineteen for a month is a fact about yourself that is
 * hard to keep not knowing. None of it was measurable until breaks stayed on
 * the clock past their own boundary.
 */

export type BreakRow = {
  /** What this break was originally going to be, from the session's settings. */
  plannedSeconds: number;
  /** What it was aiming at by the end, after any deliberate extension. */
  targetSeconds: number;
  elapsedSeconds: number;
  /** Time past `targetSeconds`. Deliberate extensions are NOT in here. */
  overtimeSeconds: number;
};

export type BreakSummary = {
  count: number;
  /** How long the breaks were meant to be, before anything was added. */
  plannedSeconds: number;
  /** How long they actually took. */
  takenSeconds: number;
  /** Time added on purpose. */
  extendedSeconds: number;
  /** Time that got away. */
  overrunSeconds: number;
  /** How many of them ran over at all. */
  overranCount: number;
  /**
   * The typical break, as a median.
   *
   * Median rather than mean, and this is not a detail: one break left running
   * over lunch is a three-hour row, and a mean would let that single afternoon
   * define the sentence for the whole month. The number has to describe the
   * ordinary day or nobody will believe the extraordinary one.
   */
  medianTakenSeconds: number;
  /** The typical *planned* length, for the "you say five, you take..." line. */
  medianPlannedSeconds: number;
};

export function summariseBreaks(rows: BreakRow[]): BreakSummary {
  const empty: BreakSummary = {
    count: 0,
    plannedSeconds: 0,
    takenSeconds: 0,
    extendedSeconds: 0,
    overrunSeconds: 0,
    overranCount: 0,
    medianTakenSeconds: 0,
    medianPlannedSeconds: 0,
  };
  if (rows.length === 0) return empty;

  let plannedSeconds = 0;
  let takenSeconds = 0;
  let extendedSeconds = 0;
  let overrunSeconds = 0;
  let overranCount = 0;

  for (const row of rows) {
    plannedSeconds += Math.max(0, row.plannedSeconds);
    takenSeconds += Math.max(0, row.elapsedSeconds);
    // A target above what was planned is time someone asked for. Clamped at
    // zero because a shorter target means the settings changed under an old
    // row, not that time was handed back.
    extendedSeconds += Math.max(0, row.targetSeconds - row.plannedSeconds);
    overrunSeconds += Math.max(0, row.overtimeSeconds);
    if (row.overtimeSeconds > 0) overranCount += 1;
  }

  return {
    count: rows.length,
    plannedSeconds,
    takenSeconds,
    extendedSeconds,
    overrunSeconds,
    overranCount,
    medianTakenSeconds: median(rows.map((row) => Math.max(0, row.elapsedSeconds))),
    medianPlannedSeconds: median(
      rows.map((row) => Math.max(0, row.plannedSeconds)),
    ),
  };
}

/**
 * Is there a story here worth telling?
 *
 * One overrun is a Tuesday. The line is only worth the space when the typical
 * break is meaningfully longer than the typical plan — otherwise it is a stat
 * that exists to make someone feel watched.
 */
export function breaksWorthReporting(summary: BreakSummary): boolean {
  return (
    summary.count >= 3 &&
    summary.medianPlannedSeconds > 0 &&
    summary.medianTakenSeconds > summary.medianPlannedSeconds * 1.2
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}
