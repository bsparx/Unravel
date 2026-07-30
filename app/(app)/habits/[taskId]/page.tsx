import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { TaskForm } from "@/app/(app)/tasks/_components/task-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { requireUser } from "@/lib/auth";
import { toISODate } from "@/lib/dates";
import { toWorkMode } from "@/lib/timer-math";
import { getAnchorHabits, getProjects, getTask } from "@/lib/tasks";

import { deleteHabit, updateHabit } from "../actions";

export const metadata = { title: "Edit habit" };

export default async function EditHabitPage({
  params,
}: PageProps<"/habits/[taskId]">) {
  const user = await requireUser();
  // Next 16: params is a Promise.
  const { taskId } = await params;

  const [habit, projects, habits] = await Promise.all([
    getTask(user, taskId),
    getProjects(user),
    getAnchorHabits(user, taskId),
  ]);

  if (!habit || habit.type !== "HABIT") notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/habits"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Habits
      </Link>

      <h1 className="text-heading mb-8">Edit habit</h1>

      <TaskForm
        kind="HABIT"
        action={updateHabit}
        projects={projects}
        habits={habits}
        submitLabel="Save habit"
        redirectTo="/habits"
        values={{
          id: habit.id,
          title: habit.title,
          notes: habit.notes,
          priority: habit.priority,
          projectId: habit.projectId,
          estimateMinutes: habit.estimatedSeconds
            ? Math.round(habit.estimatedSeconds / 60)
            : null,
          defaultMode: toWorkMode(habit.defaultMode),
          plannedIntervals: habit.plannedIntervals,
          steps: habit.steps.map((step) => ({
            id: step.id,
            title: step.title,
            estimateMinutes: step.estimatedSeconds
              ? Math.round(step.estimatedSeconds / 60)
              : null,
          })),
          daysOfWeek: habit.recurrence?.daysOfWeek,
          startDate: habit.recurrence
            ? toISODate(habit.recurrence.startDate)
            : null,
          endDate: habit.recurrence?.endDate
            ? toISODate(habit.recurrence.endDate)
            : null,
          unit: habit.recurrence?.unit,
          minimumQuota: habit.recurrence?.minimumQuota,
          optimalQuota: habit.recurrence?.optimalQuota ?? null,
          cueMode: habit.cue
            ? habit.cue.anchorTaskId
              ? "habit"
              : "label"
            : "none",
          cueTaskId: habit.cue?.anchorTaskId ?? null,
          cueLabel: habit.cue?.anchorLabel ?? null,
          cueMinutes: habit.cue?.anchorMinutes,
        }}
      />

      <div className="border-border mt-10 flex items-center justify-between gap-4 border-t pt-6">
        <p className="text-muted-foreground text-label">
          Deleting also removes every logged session for this habit. Archiving
          keeps the history.
        </p>
        <ConfirmDelete
          action={deleteHabit}
          taskId={habit.id}
          label="Delete habit"
          title={`Delete "${habit.title}"?`}
          description="This also removes its whole history — every tick, every logged session, and any calendar blocks pointing at it. Your stats totals will change. Archiving keeps it."
          redirectTo="/habits"
        />
      </div>
    </div>
  );
}
