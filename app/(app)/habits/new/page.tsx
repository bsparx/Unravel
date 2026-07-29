import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/tasks";
import { TaskForm } from "@/app/(app)/tasks/_components/task-form";

import { createHabit } from "../actions";

export const metadata = { title: "New habit" };

export default async function NewHabitPage() {
  const user = await requireUser();
  const projects = await getProjects(user);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <Link
        href="/habits"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-label"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Habits
      </Link>

      <h1 className="text-heading mb-1">Add a habit</h1>
      <p className="text-muted-foreground mb-8 text-label">
        Something recurring. It shows up on the days you pick and nowhere else —
        missing a Tuesday doesn&apos;t break a Mon/Wed/Fri habit.
      </p>

      <TaskForm
        kind="HABIT"
        action={createHabit}
        projects={projects}
        submitLabel="Add habit"
        redirectTo="/habits"
      />
    </div>
  );
}
