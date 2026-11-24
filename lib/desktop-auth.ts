import "server-only";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import {
  extractBearerToken,
  hashDesktopSecret,
} from "@/lib/desktop-auth-utils";

/** Throttle `lastUsedAt` writes so 60s heartbeats don't churn the token row. */
const LAST_USED_TOUCH_MS = 5 * 60 * 1000;

export type DesktopAuthContext = {
  user: User;
  tokenId: string;
};

/**
 * Authenticate a desktop API request using `Authorization: Bearer unr_...`.
 *
 * Looks up the SHA-256 hash in `DesktopApiToken`, ensures it hasn't been
 * revoked, and scopes the rest of the request strictly to `token.user`.
 */
export async function authenticateDesktopRequest(
  request: Request,
): Promise<DesktopAuthContext | null> {
  const rawToken = extractBearerToken(request.headers.get("authorization"));
  if (!rawToken) return null;

  const tokenHash = hashDesktopSecret(rawToken);
  const record = await prisma.desktopApiToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.revokedAt !== null) {
    return null;
  }

  const now = new Date();
  if (
    !record.lastUsedAt ||
    now.getTime() - record.lastUsedAt.getTime() > LAST_USED_TOUCH_MS
  ) {
    // Non-blocking best-effort touch.
    void prisma.desktopApiToken
      .update({
        where: { id: record.id },
        data: { lastUsedAt: now },
      })
      .catch(() => {});
  }

  return { user: record.user, tokenId: record.id };
}
