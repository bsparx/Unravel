/**
 * The budget domain: what a category is, and the built-in set.
 *
 * A category belongs to one side of the ledger (income or expense) and either
 * to everyone (`GLOBAL_OWNER`) or to one user. The globals are seeded into the
 * database — not a constant read at render time — so a transaction's foreign
 * key holds for them exactly as it does for a user category, and renaming a
 * category later relabels history rather than orphaning it.
 */

import { prisma } from "@/lib/db";
import type { MoneyKind } from "@/lib/generated/prisma/client";

import {
  CATEGORY_COLORS,
  EXPENSE_COLORS,
  INCOME_COLORS,
} from "./money-palette";

export { CATEGORY_COLORS };

/** `ownerKey` for the seeded built-ins. */
export const GLOBAL_OWNER = "global";

/**
 * The built-in categories. `color` is a palette token resolved to a CSS
 * variable in the UI (see `CATEGORY_COLORS` in `lib/money-palette.ts`); clay
 * is deliberately absent — it is the "something went wrong" colour, and a
 * category is never that.
 *
 * Every global income wears its own `INCOME_COLORS` hue and every global
 * expense its own `EXPENSE_COLORS` hue — the two groups never share a colour,
 * and neither group repeats one.
 */
export const GLOBAL_CATEGORIES: {
  kind: MoneyKind;
  name: string;
  color: keyof typeof CATEGORY_COLORS;
}[] = [
  { kind: "INCOME", name: "Salary", color: INCOME_COLORS[0] },
  { kind: "INCOME", name: "Freelance", color: INCOME_COLORS[1] },
  { kind: "INCOME", name: "Gifts", color: INCOME_COLORS[2] },
  { kind: "INCOME", name: "Other income", color: INCOME_COLORS[3] },
  { kind: "EXPENSE", name: "Food", color: EXPENSE_COLORS[0] },
  { kind: "EXPENSE", name: "Groceries", color: EXPENSE_COLORS[1] },
  { kind: "EXPENSE", name: "Transport", color: EXPENSE_COLORS[2] },
  { kind: "EXPENSE", name: "Housing", color: EXPENSE_COLORS[3] },
  { kind: "EXPENSE", name: "Utilities", color: EXPENSE_COLORS[4] },
  { kind: "EXPENSE", name: "Medical", color: EXPENSE_COLORS[5] },
  { kind: "EXPENSE", name: "Shopping", color: EXPENSE_COLORS[6] },
  { kind: "EXPENSE", name: "Entertainment", color: EXPENSE_COLORS[7] },
  { kind: "EXPENSE", name: "Subscriptions", color: EXPENSE_COLORS[8] },
  { kind: "EXPENSE", name: "Other expenses", color: EXPENSE_COLORS[9] },
];

/**
 * Idempotent: upserts every built-in by its unique key. Called from the budget
 * page loader and the seed, so a fresh database and an account that existed
 * before the budget did both get the same starting set. The update re-applies
 * the colour, so a palette change recovers rows seeded under an older one.
 *
 * The steady state is one query, not fourteen: the globals are seeded once and
 * never change, so a single findMany that finds them all — names and colours
 * intact — returns without opening a transaction at all. Only a first run (or
 * a palette change) pays for the upserts, and that pass carries a raised
 * timeout: Neon over HTTP spends ~400ms per round-trip, and fourteen of those
 * bust Prisma's default 5s transaction budget (P2028).
 */
export async function ensureGlobalCategories(): Promise<void> {
  const existing = await prisma.moneyCategory.findMany({
    where: { ownerKey: GLOBAL_OWNER },
    select: { kind: true, name: true, color: true },
  });

  const seededColor = new Map(
    existing.map((row) => [`${row.kind}:${row.name}`, row.color]),
  );
  const allSeeded = GLOBAL_CATEGORIES.every(
    (category) =>
      seededColor.get(`${category.kind}:${category.name}`) ===
      category.color,
  );
  if (allSeeded) return;

  await prisma.$transaction(
    GLOBAL_CATEGORIES.map((category, index) =>
      prisma.moneyCategory.upsert({
        where: {
          ownerKey_kind_name: {
            ownerKey: GLOBAL_OWNER,
            kind: category.kind,
            name: category.name,
          },
        },
        create: {
          ownerKey: GLOBAL_OWNER,
          kind: category.kind,
          name: category.name,
          color: category.color,
          sortOrder: index,
        },
        update: { color: category.color },
      }),
    ),
    { timeout: 20_000 },
  );
}
