import { NextResponse } from "next/server";

import { getActiveSession } from "@/app/(app)/timer/_lib/session-hydrate";
import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { isDueOn } from "@/lib/recurrence";

/**
 * Initial hydration payload for the Ubuntu desktop companion:
 * user info, all timer settings, active cross-device session (if any),
 * and today's attachable open todos + active habits.
 */
export async function GET(request: Request) {
  const ctx = await authenticateDesktopRequest(request);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = ctx;
  const today = todayLocal(user.timezone);

  const [activeSession, rawTasks] = await Promise.all([
    getActiveSession(user),
    prisma.task.findMany({
      where: {
        userId: user.id,
        archivedAt: null,
        OR: [{ type: "HABIT" }, { type: "TODO", completedAt: null }],
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true,
        title: true,
        type: true,
        estimatedSeconds: true,
        defaultMode: true,
        plannedIntervals: true,
        recurrence: {
          select: {
            daysOfWeek: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
  ]);

  const tasks = rawTasks
    .filter((t) => {
      if (t.type === "TODO") return true;
      if (!t.recurrence) return true;
      return isDueOn(t.recurrence, today);
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      estimatedSeconds: t.estimatedSeconds,
      defaultMode: t.defaultMode,
      plannedIntervals: t.plannedIntervals,
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
    tasks,
  });
}
