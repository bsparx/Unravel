import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  desktopExchangeSchema,
  generateDesktopToken,
  hashDesktopSecret,
  verifyPkceChallenge,
} from "@/lib/desktop-auth-utils";

/**
 * Exchange a 60-second single-use PKCE authorization code from `/desktop/connect`
 * for a revocable per-user `unr_...` desktop token over HTTPS.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = desktopExchangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid code or verifier." },
      { status: 400 },
    );
  }

  const now = new Date();
  const codeHash = hashDesktopSecret(parsed.data.code);

  // Best-effort cleanup of expired codes.
  void prisma.desktopAuthCode
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => {});

  const authCode = await prisma.desktopAuthCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: { id: true, name: true, email: true, timezone: true },
      },
    },
  });

  if (!authCode || authCode.expiresAt.getTime() < now.getTime()) {
    if (authCode) {
      await prisma.desktopAuthCode
        .deleteMany({ where: { id: authCode.id } })
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Authorization code is invalid or expired." },
      { status: 401 },
    );
  }

  if (!verifyPkceChallenge(parsed.data.codeVerifier, authCode.codeChallenge)) {
    return NextResponse.json(
      { error: "PKCE verification failed." },
      { status: 401 },
    );
  }

  // Atomic single-use claim: delete the code first so concurrent replays fail.
  const deleted = await prisma.desktopAuthCode.deleteMany({
    where: { id: authCode.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: "Authorization code already used." },
      { status: 401 },
    );
  }

  const { rawToken, tokenHash, prefix } = generateDesktopToken();

  await prisma.desktopApiToken.create({
    data: {
      userId: authCode.userId,
      label: authCode.label,
      tokenHash,
      prefix,
      lastUsedAt: now,
    },
  });

  return NextResponse.json({
    token: rawToken,
    prefix,
    label: authCode.label,
    user: {
      name: authCode.user.name,
      email: authCode.user.email,
      timezone: authCode.user.timezone,
    },
  });
}
