"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toggleTodo } from "@/app/(app)/tasks/actions";
import { formatRelativeDate } from "@/lib/dates";
import type { TaskSummary } from "@/lib/tasks";
import { TaskRow } from "@/app/(app)/day/_components/task-row";

export function TaskList({
  tasks,
  today,
}: {
  tasks: TaskSummary[];
  today: Date;
}) {
  const toggle = async (taskId: string, next: boolean) => {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("done", String(next));
    await toggleTodo(formData);
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No tasks here"
        description="One-off things live here. Recurring ones belong on the habits page."
        action={
          <Button asChild size="sm">
            <Link href="/tasks/new">Add a task</Link>
          </Button>
        }
      />
    );
  }

  // Grouped by list, because "which project is this" is the question people
  // actually scan a full task list with.
  const groups = new Map<string, { name: string; tasks: TaskSummary[] }>();
  for (const task of tasks) {
    const key = task.project?.id ?? "none";
    const group = groups.get(key) ?? {
      name: task.project?.name ?? "No list",
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(key, group);
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([key, group]) => (
        <section key={key}>
          <h2 className="text-micro text-muted-foreground mb-1 font-sans font-medium tracking-wider uppercase">
            {group.name}
            <span className="ml-2 tabular-nums opacity-60">
              {group.tasks.length}
            </span>
          </h2>
          <ul>
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                item={{
                  ...task,
                  occurrenceStatus: null,
                  loggedSeconds: 0,
                  done: task.completedAt !== null,
                  daysUntilDue: task.dueDate
                    ? Math.round(
                        (task.dueDate.getTime() - today.getTime()) / 86_400_000,
                      )
                    : null,
                  recurrenceDays: null,
                }}
                onToggle={(next) => toggle(task.id, next)}
                showDueLabel={
                  task.dueDate
                    ? formatRelativeDate(task.dueDate, today)
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
