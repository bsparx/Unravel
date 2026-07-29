import { NextResponse } from "next/server";

import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Flush a running session's clock when the tab goes away.
 *
 * This exists only because `navigator.sendBeacon` can't invoke a Server Action
 * — a closing page has no time to await one. Without it, closing the laptop
 * mid-session would lose everything since the last heartbeat.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let sessionId: unknown;
  try {
    ({ sessionId } = await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await prisma.focusSession.findFirst({
    where: { id: sessionId, userId: user.id, status: "RUNNING" },
  });

  if (!session?.runningSince) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const accumulated = Math.floor(
    session.accumulatedSeconds +
      Math.max(0, (now.getTime() - session.runningSince.getTime()) / 1000),
  );

  await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      accumulatedSeconds: accumulated,
      runningSince: now,
      lastBeatAt: now,
    },
  });

  return NextResponse.json({ ok: true });
}
