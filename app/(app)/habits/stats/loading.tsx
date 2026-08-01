import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-5">
            <Skeleton className="mb-4 h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
          </div>
          <div className="rounded-lg border p-5">
            <Skeleton className="mb-4 h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="mt-2 h-3 w-full rounded-md" />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Skeleton className="mb-3 h-4 w-32 rounded-md" />
          <div className="flex items-end gap-2">
            {[45, 70, 55, 85, 60, 90, 50, 75].map((height, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-md"
                style={{ height: `${height * 0.5}px` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton className="h-3 w-16 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-12 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
