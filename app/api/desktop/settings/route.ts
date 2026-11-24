import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { desktopSettingsPatchSchema } from "@/lib/desktop-auth-utils";

/** Update the user's synced Unravel timer defaults & alert toggles. */
export async function PATCH(request: Request) {
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

  const parsed = desktopSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const nextShortMin =
    input.shortBreakMinutes ?? Math.round(ctx.user.shortBreakSeconds / 60);
  const nextLongMin =
    input.longBreakMinutes ?? Math.round(ctx.user.longBreakSeconds / 60);

  if (nextLongMin < nextShortMin) {
    return NextResponse.json(
      { error: "Long break must be at least as long as short break." },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: ctx.user.id },
    data: {
      ...(input.pomodoroMinutes !== undefined
        ? { pomodoroSeconds: input.pomodoroMinutes * 60 }
        : {}),
      ...(input.shortBreakMinutes !== undefined
        ? { shortBreakSeconds: input.shortBreakMinutes * 60 }
        : {}),
      ...(input.longBreakMinutes !== undefined
        ? { longBreakSeconds: input.longBreakMinutes * 60 }
        : {}),
      ...(input.longBreakEvery !== undefined
        ? { longBreakEvery: input.longBreakEvery }
        : {}),
      ...(input.autoStartBreaks !== undefined
        ? { autoStartBreaks: input.autoStartBreaks }
        : {}),
      ...(input.autoStartNextFocus !== undefined
        ? { autoStartNextFocus: input.autoStartNextFocus }
        : {}),
      ...(input.soundEnabled !== undefined
        ? { soundEnabled: input.soundEnabled }
        : {}),
      ...(input.hapticsEnabled !== undefined
        ? { hapticsEnabled: input.hapticsEnabled }
        : {}),
      ...(input.returnAlertsEnabled !== undefined
        ? { returnAlertsEnabled: input.returnAlertsEnabled }
        : {}),
    },
  });

  return NextResponse.json({
    settings: {
      focusSeconds: updated.pomodoroSeconds,
      shortBreakSeconds: updated.shortBreakSeconds,
      longBreakSeconds: updated.longBreakSeconds,
      longBreakEvery: updated.longBreakEvery,
      autoStartBreaks: updated.autoStartBreaks,
      autoStartNextFocus: updated.autoStartNextFocus,
      soundEnabled: updated.soundEnabled,
      hapticsEnabled: updated.hapticsEnabled,
      returnAlertsEnabled: updated.returnAlertsEnabled,
    },
  });
}
