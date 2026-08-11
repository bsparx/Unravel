import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { Landing } from "@/app/_components/landing";
import { requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";
import { formatFullDate, toISODate, todayLocal } from "@/lib/dates";
import { getDayLog } from "@/lib/day-log";
import { prisma } from "@/lib/db";
import { formatMinutes } from "@/lib/dates";
import { getProjects } from "@/lib/tasks";

import {
  MorningPass,
  type PassOption,
} from "./_components/morning-pass";
import { OneThingCard } from "./_components/one-thing-card";

/** How many candidates the morning pass offers. Short on purpose. */
const CANDIDATES = 5;

export default async function HomePage() {
  // Clerk 7: auth() is async.
  const { userId } = await auth();
  if (!userId) return <Landing />;

  const user = await requireUser();
  const today = todayLocal(user.timezone);
  const dateISO = toISODate(today);
  const dayLog = await getDayLog(user, today);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-micro text-muted-foreground mb-8 font-medium tracking-wider uppercase">
        {formatFullDate(today)}
      </p>

      {dayLog?.selectedTask ? (
        <OneThingCard dayLog={dayLog} dateISO={dateISO} />
      ) : (
        <MorningPass
          options={await candidateOptions(user)}
          dateISO={dateISO}
          projects={await getProjects(user)}
        />
      )}

      {/* The only way out of this screen, and it's quiet on purpose. */}
      <nav className="text-muted-foreground mt-16 flex gap-5 text-label">
        <Link
          href="/day"
          className="hover:text-foreground underline underline-offset-4"
        >
          The whole day
        </Link>
        <Link
          href="/behavior"
          className="hover:text-foreground underline underline-offset-4"
        >
          Behavior
        </Link>
        <Link
          href="/close"
          className="hover:text-foreground underline underline-offset-4"
        >
          Close the day
        </Link>
      </nav>
    </main>
  );
}

/**
 * What to offer in the morning pass: whatever's overdue or due today first,
 * then whatever you dumped most recently. Deliberately capped — this is a
 * choice, not a backlog review.
 */
async function candidateOptions(
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<PassOption[]> {
  const today = todayLocal(user.timezone);

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
      select: {
        id: true,
        title: true,
        estimatedSeconds: true,
        dueDate: true,
      },
    }),
    getRawCaptures(user, CANDIDATES),
  ]);

  const taskOptions: PassOption[] = tasks.map((task) => ({
    kind: "task",
    id: task.id,
    label: task.title,
    detail: [
      task.dueDate && task.dueDate.getTime() < today.getTime()
        ? "overdue"
        : null,
      task.estimatedSeconds ? formatMinutes(task.estimatedSeconds) : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  const captureOptions: PassOption[] = captures.map((capture) => ({
    kind: "capture",
    id: capture.id,
    label: capture.body.split("\n")[0].slice(0, 120),
    detail: "from your behavior log",
  }));

  return [...taskOptions, ...captureOptions].slice(0, CANDIDATES * 2);
}
