import Link from "next/link";
import { CalendarDays, MoonStar, NotebookPen, type LucideIcon } from "lucide-react";

import { Landing } from "@/app/_components/landing";
import { BrandMark } from "@/components/brand-mark";
import { IdentityChip } from "@/components/identity-sigil";
import { ensureUser, type requireUser } from "@/lib/auth";
import { getRawCaptures } from "@/lib/captures";
import { formatFullDate, minuteOfDayLocal, toISODate, todayLocal } from "@/lib/dates";
import { getDayLog } from "@/lib/day-log";
import { prisma } from "@/lib/db";
import { formatMinutes } from "@/lib/dates";
import { getLeadLook } from "@/lib/identity-votes";
import { getProjects } from "@/lib/tasks";

import {
  MorningPass,
  type PassOption,
} from "./_components/morning-pass";
import { OneThingCard } from "./_components/one-thing-card";

/** How many candidates the morning pass offers. Short on purpose. */
const CANDIDATES = 5;

export default async function HomePage() {
  // The same cached lookup the focus layout already made: signed out is the
  // landing, signed in (even on the very first request) is a user row.
  const user = await ensureUser();
  if (!user) return <Landing />;

  const today = todayLocal(user.timezone);
  const dateISO = toISODate(today);
  // The lead is only a greeting detail, so it rides along with the day log.
  const [dayLog, lead] = await Promise.all([getDayLog(user, today), getLeadLook(user)]);
  // Only the pass needs these, and they don't depend on each other.
  const [options, projects] = dayLog?.selectedTask
    ? [[], []]
    : await Promise.all([candidateOptions(user), getProjects(user)]);

  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <header className="animate-rise mb-6 px-1 sm:mb-8">
        <p className="text-muted-foreground flex items-center gap-2 text-label">
          <BrandMark className="text-primary size-5" />
          <span className="font-mono">{formatFullDate(today)}</span>
        </p>
        <p className="font-display mt-3 text-heading sm:text-[1.75rem] sm:leading-9">
          {greeting(minuteOfDayLocal(user.timezone))}
          {firstName ? `, ${firstName}` : ""}.
        </p>
        {lead && (
          <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-label">
            <IdentityChip name={lead.short} sigil={lead.sigil} slot={lead.colorSlot} />
            leads today.
          </p>
        )}
      </header>

      {/* One frosted panel, so the choice has a place to land on the field. */}
      <section className="bg-card animate-rise rounded-[28px] border border-[var(--card-edge)] px-5 pt-4 pb-6 shadow-[var(--card-shadow)] [animation-delay:60ms] sm:px-8 sm:pb-8">
        {dayLog?.selectedTask ? (
          <OneThingCard dayLog={dayLog} dateISO={dateISO} />
        ) : (
          <MorningPass
            options={options}
            dateISO={dateISO}
            projects={projects}
          />
        )}
      </section>

      {/* The only way out of this screen, and it's quiet on purpose. */}
      <nav aria-label="Elsewhere" className="mt-8 flex flex-wrap gap-2 px-1">
        <QuietLink href="/day" icon={CalendarDays}>The whole day</QuietLink>
        <QuietLink href="/behavior" icon={NotebookPen}>Behavior</QuietLink>
        <QuietLink href="/close" icon={MoonStar}>Close the day</QuietLink>
      </nav>
    </main>
  );
}

/** A greeting for the hour where you are. Plain words, no cheerleading. */
function greeting(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "A quiet hour";
}

function QuietLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground hover:bg-card focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent px-4 text-label transition-colors hover:border-[var(--card-edge)] focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Link>
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
