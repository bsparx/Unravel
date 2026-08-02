/**
 * The palette a money category may wear. Deliberately excludes clay: clay is
 * reserved for "something went wrong" and for spending itself, so it is never
 * a category's identity. These are the existing chart hues — the budget adds
 * no new colour.
 */
export const CATEGORY_COLORS = {
  teal: "var(--primary)",
  sage: "var(--chart-3)",
  sand: "var(--chart-4)",
  ink: "var(--foreground)",
} as const;

export type CategoryColor = keyof typeof CATEGORY_COLORS;
