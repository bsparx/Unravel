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

import { CATEGORY_COLORS } from "./money-palette";

export { CATEGORY_COLORS };

/** `ownerKey` for the seeded built-ins. */
export const GLOBAL_OWNER = "global";

/**
 * The built-in categories. `color` is a palette token resolved to a CSS
 * variable in the UI (see `CATEGORY_COLORS` in `lib/money-palette.ts`); clay
 * is deliberately absent — it is the "something went wrong" colour, and a
 * category is never that.
 */
export const GLOBAL_CATEGORIES: {
  kind: MoneyKind;
  name: string;
  color: keyof typeof CATEGORY_COLORS;
}[] = [
  { kind: "INCOME", name: "Salary", color: "teal" },
  { kind: "INCOME", name: "Freelance", color: "sage" },
  { kind: "INCOME", name: "Gifts", color: "sand" },
  { kind: "INCOME", name: "Other income", color: "ink" },
  { kind: "EXPENSE", name: "Food", color: "sand" },
  { kind: "EXPENSE", name: "Groceries", color: "sage" },
  { kind: "EXPENSE", name: "Transport", color: "teal" },
  { kind: "EXPENSE", name: "Housing", color: "ink" },
  { kind: "EXPENSE", name: "Utilities", color: "sand" },
  { kind: "EXPENSE", name: "Medical", color: "teal" },
  { kind: "EXPENSE", name: "Shopping", color: "sage" },
  { kind: "EXPENSE", name: "Entertainment", color: "sand" },
  { kind: "EXPENSE", name: "Subscriptions", color: "ink" },
  { kind: "EXPENSE", name: "Other expenses", color: "teal" },
];

/**
 * Idempotent: upserts every built-in by its unique key. Called from the budget
 * page loader and the seed, so a fresh database and an account that existed
 * before the budget did both get the same starting set.
 */
export async function ensureGlobalCategories(): Promise<void> {
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
        update: {},
      }),
    ),
  );
}
