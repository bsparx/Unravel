import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </header>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="mt-2 flex justify-between">
            <Skeleton className="h-3 w-8 rounded-md" />
            <Skeleton className="h-3 w-8 rounded-md" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, habit) => (
            <div key={habit} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-md" />
                <Skeleton
                  className="h-4 rounded-md"
                  style={{ width: `${55 + (habit % 3) * 10}%` }}
                />
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {Array.from({ length: 8 }).map((_, week) => (
                  <Skeleton
                    key={week}
                    className="h-8 rounded-md"
                    style={{ opacity: 1 - ((habit + week) % 4) * 0.16 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
