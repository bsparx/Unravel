import { NextResponse } from "next/server";

import { getActiveSession } from "@/app/(app)/timer/_lib/session-hydrate";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { getDesktopDayPayload } from "@/lib/desktop-day";

/**
 * Initial hydration payload for the Ubuntu desktop companion:
 * user info, all timer settings, active cross-device session (if any),
 * and today's full `/day` task & habit list.
 */
export async function GET(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = ctx;
  const [activeSession, day] = await Promise.all([
    getActiveSession(user),
    getDesktopDayPayload(user),
  ]);

  // Flat attachable list for backwards compatibility with any caller reading `tasks`.
  const tasks = [
    ...day.overdue,
    ...day.dueToday,
    ...day.habits,
    ...day.undated,
  ].map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    estimatedSeconds: item.estimatedSeconds,
    defaultMode: item.defaultMode,
    plannedIntervals: item.plannedIntervals,
  }));

  return NextResponse.json({
    serverTimeMs: Date.now(),
    user: {
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      weekStart: user.weekStart,
    },
    settings: {
      focusSeconds: user.pomodoroSeconds,
      shortBreakSeconds: user.shortBreakSeconds,
      longBreakSeconds: user.longBreakSeconds,
      longBreakEvery: user.longBreakEvery,
      autoStartBreaks: user.autoStartBreaks,
      autoStartNextFocus: user.autoStartNextFocus,
      soundEnabled: user.soundEnabled,
      hapticsEnabled: user.hapticsEnabled,
      returnAlertsEnabled: user.returnAlertsEnabled,
    },
    activeSession,
    day,
    tasks,
  });
}
