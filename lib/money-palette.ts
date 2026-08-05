/**
 * The palette a money category may wear. Deliberately excludes clay: clay is
 * reserved for "something went wrong" and for spending itself, so it is never
 * a category's identity.
 *
 * The colours are split into three disjoint groups, so every global income
 * category, every global expense category and every custom picker option can
 * claim its own hue:
 *
 * - `INCOME_COLORS`  — the original four tokens, worn by the built-in incomes.
 * - `EXPENSE_COLORS` — ten hues worn by the built-in expenses.
 * - `CUSTOM_COLORS`  — ten more hues offered to user-made categories.
 */
export const CATEGORY_COLORS = {
  teal: "var(--primary)",
  sage: "var(--chart-3)",
  sand: "var(--chart-4)",
  ink: "var(--foreground)",
  amber: "var(--money-amber)",
  rust: "var(--money-rust)",
  rose: "var(--money-rose)",
  plum: "var(--money-plum)",
  violet: "var(--money-violet)",
  indigo: "var(--money-indigo)",
  denim: "var(--money-denim)",
  azure: "var(--money-azure)",
  slate: "var(--money-slate)",
  pine: "var(--money-pine)",
  moss: "var(--money-moss)",
  olive: "var(--money-olive)",
  fern: "var(--money-fern)",
  sky: "var(--money-sky)",
  stone: "var(--money-stone)",
  cocoa: "var(--money-cocoa)",
  bronze: "var(--money-bronze)",
  blush: "var(--money-blush)",
  lilac: "var(--money-lilac)",
  peach: "var(--money-peach)",
} as const;

export type CategoryColor = keyof typeof CATEGORY_COLORS;

/** The built-in income categories' hues, in picker order. */
export const INCOME_COLORS = ["teal", "sage", "sand", "ink"] as const;

/** The built-in expense categories' hues — none shared with the incomes. */
export const EXPENSE_COLORS = [
  "amber",
  "rust",
  "rose",
  "plum",
  "violet",
  "denim",
  "azure",
  "slate",
  "moss",
  "olive",
] as const;

/**
 * The hues offered when making a custom category — ten fresh shades that
 * belong to neither the global incomes nor the global expenses.
 */
export const CUSTOM_COLORS = [
  "indigo",
  "pine",
  "fern",
  "sky",
  "stone",
  "cocoa",
  "bronze",
  "blush",
  "lilac",
  "peach",
] as const;

/** Every colour a category or account may wear, for server-side validation. */
export const MONEY_COLOR_NAMES = [
  ...INCOME_COLORS,
  ...EXPENSE_COLORS,
  ...CUSTOM_COLORS,
] as const;
