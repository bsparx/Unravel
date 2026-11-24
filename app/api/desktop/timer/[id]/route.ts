import { NextResponse } from "next/server";

import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { desktopTimerActionSchema } from "@/lib/desktop-auth-utils";
import {
  adjustUserLoggedTime,
  advanceUserInterval,
  appendUserFlowRound,
  discardUserSession,
  endUserSession,
  extendUserInterval,
  heartbeatUserSession,
  pauseUserSession,
  resumeUserSession,
  setUserReturnNote,
} from "@/lib/timer-service";

/** Mutate a live or finished desktop timer session (pause, resume, flow, end, etc.). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = desktopTimerActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid timer action." },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  switch (payload.action) {
    case "pause": {
      const session = await pauseUserSession(ctx.user, id);
      return NextResponse.json({ ok: session !== null, session });
    }
    case "resume": {
      const session = await resumeUserSession(ctx.user, id);
      return NextResponse.json({ ok: session !== null, session });
    }
    case "heartbeat": {
      const session = await heartbeatUserSession(ctx.user, id);
      return NextResponse.json({ ok: session !== null, session });
    }
    case "advance": {
      const session = await advanceUserInterval(
        ctx.user,
        id,
        payload.nextIndex,
        payload.completed,
        { resume: payload.resume },
      );
      return NextResponse.json({ ok: session !== null, session });
    }
    case "appendFlowRound": {
      const session = await appendUserFlowRound(ctx.user, id);
      return NextResponse.json({ ok: session !== null, session });
    }
    case "extend": {
      const session = await extendUserInterval(ctx.user, id, payload.seconds);
      return NextResponse.json({ ok: session !== null, session });
    }
    case "returnNote": {
      await setUserReturnNote(ctx.user, id, payload.note);
      return NextResponse.json({ ok: true });
    }
    case "end": {
      const session = await endUserSession(ctx.user, id, {
        completedTask: payload.completedTask,
        reason: payload.reason,
      });
      return NextResponse.json({ ok: session !== null, session });
    }
    case "adjust": {
      const result = await adjustUserLoggedTime(ctx.user, id, payload.minutes);
      if (result.status === "error") {
        return NextResponse.json({ ok: false, error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, loggedSeconds: result.loggedSeconds });
    }
  }
}

/** Discard a session started by mistake. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  await discardUserSession(ctx.user, id);
  return NextResponse.json({ ok: true });
}
