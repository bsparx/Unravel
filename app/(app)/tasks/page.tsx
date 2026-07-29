import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { getTasks, type TaskFilter } from "@/lib/tasks";
import { cn } from "@/lib/utils";

import { TaskList } from "./_components/task-list";

export const metadata = { title: "Tasks" };

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

export default async function TasksPage({
  searchParams,
}: PageProps<"/tasks">) {
  const user = await requireUser();

  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  const raw = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const filter: TaskFilter = FILTERS.some((option) => option.value === raw)
    ? (raw as TaskFilter)
    : "open";

  const tasks = await getTasks(user, filter);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display">Tasks</h1>
          <p className="text-muted-foreground mt-1 text-label">
            Everything one-off, whenever it&apos;s due.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/tasks/new">
            <Plus className="size-4" aria-hidden />
            Add
          </Link>
        </Button>
      </header>

      <nav aria-label="Filter" className="mb-6 flex gap-1">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={`/tasks?filter=${option.value}`}
            aria-current={filter === option.value ? "true" : undefined}
            className={cn(
              "focus-visible:ring-ring rounded-full px-3 py-1 text-label transition-colors focus-visible:ring-2 focus-visible:outline-none",
              filter === option.value
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <TaskList tasks={tasks} today={todayLocal(user.timezone)} />
    </div>
  );
}
