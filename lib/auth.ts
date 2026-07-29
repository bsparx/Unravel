import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

/**
 * The signed-in user's local row, created on first authed request.
 *
 * Clerk is the identity provider; this row is what everything else foreign-keys
 * to. No webhook is needed — the row is created lazily here.
 *
 * `auth()` is async in Clerk 7 / Next 16 and must always be awaited.
 */
export async function requireUser(): Promise<User> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  return createLocalUser(userId);
}

async function createLocalUser(clerkId: string): Promise<User> {
  const clerkUser = await currentUser();

  return prisma.user.create({
    data: {
      clerkId,
      email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
      name:
        [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
        clerkUser?.username ||
        null,
      imageUrl: clerkUser?.imageUrl ?? null,
    },
  });
}

/**
 * Same as `requireUser`, but returns null instead of redirecting. Use in Server
 * Actions and route handlers, where a redirect is the wrong failure mode.
 *
 * Note this does NOT create the local row — see `ensureUser` for that.
 */
export async function getUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { clerkId: userId } });
}

/**
 * Find-or-create, without redirecting.
 *
 * The focus layout needs exactly this: `/` must render for anonymous visitors,
 * so it can't call `requireUser()` — but a brand-new account whose very first
 * authed request lands on `/` has no local row yet, and `getUser()` would
 * return null and silently drop the providers.
 */
export async function ensureUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  return createLocalUser(userId);
}
