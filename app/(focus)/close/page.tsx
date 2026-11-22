import type { PassOption } from "@/app/(focus)/_components/morning-pass";
import { getStatsRange } from "@/app/(app)/stats/_lib/queries";
import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";
import { parseCloseStep } from "@/lib/close-ritual";
import {
  addDays,
  formatFullDate,
  formatMinutes,
  toISODate,
  todayLocal,
} from "@/lib/dates";
import { getDayLog } from "@/lib/day-log";
import { prisma } from "@/lib/db";
import { ENDING_SUMMARY_LOOKBACK_DAYS } from "@/lib/ending-summary";

import { StepEndingSummary } from "./_components/step-ending-summary";
import {
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
  const includeSummary = user.endingSummaryEnabled;
  const step = parseCloseStep(
    Array.isArray(params.step) ? params.step[0] : params.step,
    includeSummary,
  );

  const today = todayLocal(user.timezone);
  const tomorrow = addDays(today, 1);

  if (step === "summary") {
    const from = addDays(today, -(ENDING_SUMMARY_LOOKBACK_DAYS - 1));
    const [range, existing] = await Promise.all([
      getStatsRange(user, from, today),
      prisma.endingSummary.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: { keepDoing: true, tryTomorrow: true, avoid: true },
      }),
    ]);

    return (
      <StepEndingSummary
        todayISO={toISODate(today)}
        todayLabel={formatFullDate(today)}
        items={range.items}
        days={range.days.map((day) => ({
          iso: day.iso,
          weekday: day.weekday,
          productiveSeconds: day.productiveSeconds,
          items: day.items,
        }))}
        initial={{
          keepDoing: existing?.keepDoing ?? "",
          tryTomorrow: existing?.tryTomorrow ?? "",
          avoid: existing?.avoid ?? "",
        }}
        alreadySaved={Boolean(existing)}
      />
    );
  }

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
