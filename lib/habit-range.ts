/**
 * The habit-statistics date ranges.
 *
 * A separate module from `lib/habit-stats.ts` purely so the filter control can
 * import it: that file is `server-only` and imports Prisma, and a Client
 * Component reaching into it drags the whole query layer — and `node:module` —
 * into the browser bundle. The build fails outright rather than shipping it,
 * which is the right failure, but the fix is to keep shared constants somewhere
 * with no server dependencies.
 */

export const RANGE_DAYS = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
} as const;

export type StatsRange = keyof typeof RANGE_DAYS;

export const isStatsRange = (value: unknown): value is StatsRange =>
  typeof value === "string" && value in RANGE_DAYS;

export const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "quarter", label: "90 days" },
  { value: "year", label: "A year" },
];
