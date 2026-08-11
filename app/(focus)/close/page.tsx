import type { PassOption } from "@/app/(focus)/_components/morning-pass";
import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";
import { gratitudePrompt, parseCloseStep } from "@/lib/close-ritual";
import { addDays, formatMinutes, toISODate, todayLocal } from "@/lib/dates";
import { getDayLog } from "@/lib/day-log";
import { prisma } from "@/lib/db";

import {
  StepGratitude,
  StepHandoff,
  StepOneThing,
  StepWorry,
} from "./_components/steps";

export const metadata = { title: "Close the day" };

const CANDIDATES = 5;

export default async function ClosePage({
  searchParams,
}: PageProps<"/close">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise. The step lives here rather than in
  // state so the back button works, a refresh doesn't restart the ritual, and
  // a notification can deep-link straight to a step.
  const params = await searchParams;
  const step = parseCloseStep(
    Array.isArray(params.step) ? params.step[0] : params.step,
  );

  const today = todayLocal(user.timezone);
  const tomorrow = addDays(today, 1);

  if (step === "one-thing") {
    return (
      <StepOneThing
        options={await candidates(user)}
        dateISO={toISODate(tomorrow)}
      />
    );
  }

  if (step === "worry") {
    const existing = await prisma.journalEntry.findUnique({
      where: {
        userId_date_kind: { userId: user.id, date: today, kind: "WORRY" },
      },
      select: { body: true },
    });
    return <StepWorry initial={existing?.body ?? ""} />;
  }

  if (step === "gratitude") {
    const existing = await prisma.journalEntry.findUnique({
      where: {
        userId_date_kind: { userId: user.id, date: today, kind: "GRATITUDE" },
      },
      select: { body: true },
    });
    return (
      <StepGratitude
        initial={existing?.body ?? ""}
        prompt={gratitudePrompt(today)}
      />
    );
  }

  const tomorrowLog = await getDayLog(user, tomorrow);
  return <StepHandoff oneThing={tomorrowLog?.selectedTask?.title ?? null} />;
}

async function candidates(
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<PassOption[]> {
  const [tasks, captures] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        type: "TODO",
        completedAt: null,
        archivedAt: null,
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { sortOrder: "desc" }],
      take: CANDIDATES,
      select: { id: true, title: true, estimatedSeconds: true },
    }),
    getRawCaptures(user, CANDIDATES),
  ]);

  return [
    ...tasks.map<PassOption>((task) => ({
      kind: "task",
      id: task.id,
      label: task.title,
      detail: task.estimatedSeconds
        ? formatMinutes(task.estimatedSeconds)
        : undefined,
    })),
    ...captures.map<PassOption>((capture) => ({
      kind: "capture",
      id: capture.id,
      label: capture.body.split("\n")[0].slice(0, 120),
      detail: "from your behavior log",
    })),
  ];
}
