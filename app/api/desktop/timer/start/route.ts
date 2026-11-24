import { NextResponse } from "next/server";

import { getActiveSession } from "@/app/(app)/timer/_lib/session-hydrate";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { desktopStartSessionSchema } from "@/lib/desktop-auth-utils";
import { startUserSession } from "@/lib/timer-service";

/** Start a new idempotent focus or recovery session from the desktop app. */
export async function POST(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = desktopStartSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid timer input." },
      { status: 400 },
    );
  }

  const session = await startUserSession(ctx.user, parsed.data);
  if (!session) {
    return NextResponse.json(
      { error: "Could not start session." },
      { status: 409 },
    );
  }

  const activeSession = await getActiveSession(ctx.user);
  return NextResponse.json({ session, activeSession });
}
