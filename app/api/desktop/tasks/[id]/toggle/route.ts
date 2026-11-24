import { NextResponse } from "next/server";

import { todayLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { desktopToggleTaskSchema } from "@/lib/desktop-auth-utils";
import { getDesktopDayPayload } from "@/lib/desktop-day";
import {
  creditLoggedTime,
  getHabitBar,
  toggleHabitDone,
} from "@/lib/habit-progress";
import { logToOccurrence, setOccurrenceStatus } from "@/lib/occurrences";

/**
 * Cross off (or uncheck) any `/day` todo or habit from the Ubuntu desktop app,
 * following the exact same completion, habit-bar, and feedback rules as `/day`.
 */
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
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = desktopToggleTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const { user } = ctx;
  const { done, note, minutes } = parsed.data;
  const today = todayLocal(user.timezone);

  const [task, bar] = await Promise.all([
    prisma.task.findFirst({
      where: { id, userId: user.id, archivedAt: null },
      select: { id: true, type: true, feedbackPrompt: true },
    }),
    getHabitBar(user.id, id),
  ]);

  if (!task) {
    return NextResponse.json(
      { error: "That item no longer exists." },
      { status: 404 },
    );
  }

  if (task.type === "HABIT") {
    if (!bar) {
      return NextResponse.json(
        { error: "That habit no longer exists." },
        { status: 404 },
      );
    }

    if (done && bar.requiresFeedback) {
      const existingOcc = await prisma.taskOccurrence.findUnique({
        where: { taskId_date: { taskId: task.id, date: today } },
        select: { note: true },
      });
      const hasNote = Boolean(
        (note && note.trim()) || existingOcc?.note?.trim(),
      );
      if (!hasNote) {
        return NextResponse.json(
          {
            ok: false,
            requiresFeedback: true,
            feedbackPrompt: task.feedbackPrompt ?? null,
            error: "Write a brief reflection note before checking this habit off.",
          },
          { status: 400 },
        );
      }
    }

    if (done && ((minutes && minutes > 0) || (note && note.trim()))) {
      const occ = await logToOccurrence(user.id, task.id, today, {
        seconds: (minutes ?? 0) * 60,
        note: note?.trim() || undefined,
      });
      if (minutes && bar.unit === "MINUTES") {
        await creditLoggedTime(user.id, task.id, today, occ.loggedSeconds);
      }
    }

    await toggleHabitDone(user.id, bar, today, done);
  } else {
    if (done && minutes && minutes > 0) {
      await logToOccurrence(user.id, task.id, today, {
        seconds: minutes * 60,
      });
    }

    await prisma.task.updateMany({
      where: { id: task.id, userId: user.id, type: "TODO" },
      data: { completedAt: done ? new Date() : null },
    });

    await setOccurrenceStatus(
      user.id,
      task.id,
      today,
      done ? "DONE" : "PENDING",
    );
  }

  const day = await getDesktopDayPayload(user);
  return NextResponse.json({ ok: true, day });
}
