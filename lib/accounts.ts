/**
 * The account domain: where money lives, and the default-everything up until
 * the day accounts arrived.
 *
 * Accounts were added after the ledger already existed, so two things ran
 * before "log an entry into an account" could be the only way in:
 *
 * 1. Every user needs a default account to log into — created once, lazily,
 *    exactly like `ensureGlobalCategories` (idempotent).
 * 2. Entries logged before accounts existed have no account; backfilling them
 *    into that default keeps per-account balances and the old totals agree.
 *
 * Both are keyed to the user and are no-ops once they've happened.
 */

import { prisma } from "@/lib/db";

/** The name given to the account existing entries are backfilled into. */
export const DEFAULT_ACCOUNT_NAME = "Main";

/**
 * Create the user's default account if they don't have one. Idempotent — safe
 * to call on every /budget load and for a brand-new account. `sortOrder: 0`
 * plus the `@@index([userId, archivedAt, sortOrder])` keeps it first.
 */
export async function ensureDefaultAccount(
  userId: string,
): Promise<{ id: string }> {
  const existing = await prisma.moneyAccount.findFirst({
    where: { userId, archivedAt: null, sortOrder: 0 },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.moneyAccount.create({
    data: { userId, name: DEFAULT_ACCOUNT_NAME, sortOrder: 0 },
    select: { id: true },
  });
}

/**
 * Put every entry that predates accounts into the default account. Runs only
 * against `accountId: null` rows, so it is a no-op once done and never moves
 * an entry that already picked an account.
 */
export async function backfillDefaultAccount(
  userId: string,
  accountId: string,
): Promise<number> {
  const { count } = await prisma.moneyTransaction.updateMany({
    where: { userId, accountId: null },
    data: { accountId },
  });
  return count;
}