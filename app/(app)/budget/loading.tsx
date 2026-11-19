import { Skeleton } from "@/components/ui/skeleton";

/** The overview's shape: header, three figures, two charts, then the lists. */
export default function Loading() {
  return (
    <div className="animate-rise space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr]">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`rounded-lg border p-5 ${i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className={`mt-3 rounded-md ${i === 0 ? "h-12 w-48" : "h-8 w-36"}`} />
            <Skeleton className="mt-3 h-4 w-4/5 rounded-md" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border p-5 lg:col-span-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <div className="mt-6 space-y-5">
            {[90, 70, 52, 38, 24].map((width) => (
              <div key={width} className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 rounded-full" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border p-5 lg:col-span-3">
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="mt-6 flex h-52 items-end gap-3">
            {[55, 70, 45, 80, 60, 75].map((height, i) => (
              <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
                <Skeleton className="w-4 rounded-t-md rounded-b-none" style={{ height: `${height}%` }} />
                <Skeleton className="w-4 rounded-t-md rounded-b-none" style={{ height: `${height * 0.7}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border lg:col-span-3">
          <div className="flex items-center justify-between px-5 py-4">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          <div className="space-y-3 border-t px-5 py-4">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
