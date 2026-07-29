import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ConfirmDelete } from "@/components/confirm-delete";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDuration, formatTimestamp, toISODate } from "@/lib/dates";
import { getProjects, getTask } from "@/lib/tasks";
import { MODE_LABELS, toWorkMode } from "@/lib/timer-math";

import { deleteTask, updateTodo } from "../actions";
import { TaskForm } from "../_components/task-form";

export const metadata = { title: "Edit task" };

export default async function EditTaskPage({
  params,
}: PageProps<"/tasks/[taskId]">) {
  const user = await requireUser();
  // Next 16: params is a Promise.
  const { taskId } = await params;

  const [task, projects] = await Promise.all([
    getTask(user, taskId),
    getProjects(user),
  ]);

  if (!task || task.type !== "TODO") notFound();

  const sessions = await prisma.focusSession.findMany({
    where: { taskId: task.id, userId: user.id, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      mode: true,
      startedAt: true,
      elapsedSeconds: true,
      overtimeSeconds: true,
    },
  });

  const totalLogged = sessions.reduce(
    (sum, session) => sum + session.elapsedSeconds,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/tasks"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tasks
      </Link>

      <h1 className="text-heading mb-8">Edit task</h1>

      <TaskForm
        kind="TODO"
        action={updateTodo}
        projects={projects}
        submitLabel="Save task"
        redirectTo="/tasks"
        values={{
          id: task.id,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          projectId: task.projectId,
          dueDate: task.dueDate ? toISODate(task.dueDate) : null,
          estimateMinutes: task.estimatedSeconds
            ? Math.round(task.estimatedSeconds / 60)
            : null,
          defaultMode: toWorkMode(task.defaultMode),
          plannedIntervals: task.plannedIntervals,
          steps: task.steps.map((step) => ({
            id: step.id,
            title: step.title,
            estimateMinutes: step.estimatedSeconds
              ? Math.round(step.estimatedSeconds / 60)
              : null,
          })),
        }}
      />

      <section className="border-border mt-10 border-t pt-6">
        <h2 className="text-micro text-muted-foreground mb-3 font-sans font-medium tracking-wider uppercase">
          Time on this
        </h2>

        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-label">
            No sessions yet. Click the task anywhere in the app to open a timer
            for it.
          </p>
        ) : (
          <>
            <p className="mb-3 text-label">
              <span className="tabular-nums">
                {formatDuration(totalLogged)}
              </span>{" "}
              across {sessions.length} session
              {sessions.length === 1 ? "" : "s"}
              {task.estimatedSeconds ? (
                <span className="text-muted-foreground">
                  {" "}
                  · estimated {formatDuration(task.estimatedSeconds)}
                </span>
              ) : null}
            </p>

            <ul className="text-label">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="border-border/60 flex items-center justify-between gap-4 border-b py-2 last:border-b-0"
                >
                  <span className="text-muted-foreground">
                    {formatTimestamp(session.startedAt, user.timezone)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground text-micro tracking-wider uppercase">
                      {MODE_LABELS[session.mode]}
                    </span>
                    <span className="tabular-nums">
                      {formatDuration(session.elapsedSeconds)}
                    </span>
                    {session.overtimeSeconds > 0 && (
                      <span className="text-running tabular-nums">
                        +{formatDuration(session.overtimeSeconds)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="border-border mt-8 flex items-center justify-between gap-4 border-t pt-6">
        <p className="text-muted-foreground text-label">
          Deleting also removes every logged session for this task.
        </p>
        <ConfirmDelete
          action={deleteTask}
          taskId={task.id}
          label="Delete task"
          title={`Delete "${task.title}"?`}
          description="This also removes every session logged against it. There's no undo."
          redirectTo="/tasks"
        />
      </div>
    </div>
  );
}
