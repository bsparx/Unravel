import { Skeleton } from "@/components/ui/skeleton";

/** The income and expense pages' shape while they load. */
export function LedgerSkeleton() {
  return (
    <div className="animate-rise space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </header>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Skeleton className="col-span-2 h-11 rounded-lg sm:w-64" />
        <Skeleton className="h-11 rounded-lg sm:w-36" />
        <Skeleton className="h-11 rounded-lg sm:w-40" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2 rounded-lg border p-5">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="mt-3 h-12 w-48 rounded-md" />
          <Skeleton className="mt-3 h-4 w-3/5 rounded-md" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border p-5">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="mt-3 h-8 w-24 rounded-md" />
            <Skeleton className="mt-3 h-4 w-4/5 rounded-md" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border p-5 lg:col-span-3">
          <Skeleton className="h-4 w-24 rounded-md" />
          <div className="mt-6 flex h-48 items-end gap-1.5">
            {[30, 55, 20, 70, 45, 60, 35, 80, 50, 25, 65, 40].map((height, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-5 lg:col-span-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <div className="mt-6 space-y-5">
            {[90, 64, 45, 30].map((width) => (
              <div key={width} className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 rounded-full" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-5 py-3">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="divide-y border-t">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
