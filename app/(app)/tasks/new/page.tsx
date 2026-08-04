import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/tasks";

import { createTodo } from "../actions";
import { TaskForm } from "../_components/task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage() {
  const user = await requireUser();
  const projects = await getProjects(user);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/tasks"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tasks
      </Link>

      <h1 className="text-heading mb-1">Add a task</h1>
      <p className="text-muted-foreground mb-8 text-label">
        A one-off thing. If it comes back every week, add it as a habit instead.
      </p>

      <TaskForm
        kind="TODO"
        action={createTodo}
        projects={projects}
        submitLabel="Add task"
        redirectTo="/tasks"
      />
    </div>
  );
}
