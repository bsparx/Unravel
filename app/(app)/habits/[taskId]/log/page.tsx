import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { formatDuration, formatDateWithWeekday, toISODate } from "@/lib/dates";
import { getHabitDayLog } from "@/lib/tasks";

import { NoteLog } from "./_components/note-log";

export const metadata = { title: "Habit log" };

export default async function HabitLogPage({
  params,
}: PageProps<"/habits/[taskId]/log">) {
  const user = await requireUser();
  // Next 16: params is a Promise.
  const { taskId } = await params;

  const log = await getHabitDayLog(user, taskId);
  if (!log) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/habits"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Habits
      </Link>

      {log.entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={`Nothing logged for “${log.title}” yet`}
          description="Every day this habit carries time on the clock — or a written note, when it has one — lands here, newest first, as the weeks stack up."
        />
      ) : (
        <>
          <header className="mb-8">
            <p className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
              {log.entries.length} day{log.entries.length === 1 ? "" : "s"}
              {log.totalLoggedSeconds > 0 && (
                <>
                  {" · "}
                  <span className="text-running tabular-nums">
                    {formatDuration(log.totalLoggedSeconds)}
                  </span>{" "}
                  logged
                </>
              )}
            </p>
            <h1 className="text-display mt-1">{log.title}</h1>
          </header>

          <NoteLog
            entries={log.entries.map((entry) => ({
              dateISO: toISODate(entry.date),
              dateLabel: formatDateWithWeekday(entry.date),
              note: entry.note,
              loggedSeconds: entry.loggedSeconds,
            }))}
          />
        </>
      )}
    </div>
  );
}
