import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";

/** Revoke the caller's own desktop token on sign-out. */
export async function POST(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.desktopApiToken.updateMany({
    where: { id: ctx.tokenId, userId: ctx.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
