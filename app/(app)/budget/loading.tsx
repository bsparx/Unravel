import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </header>

        <div className="flex items-center gap-6">
          <Skeleton className="h-64 w-44 shrink-0 rounded-lg md:h-72 md:w-52" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-10 w-44 rounded-md" />
            <div className="flex gap-8 pt-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Skeleton className="mb-4 h-4 w-32 rounded-md" />
          <Skeleton className="h-44 w-full rounded-md" />
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          <div className="space-y-4 border-t px-5 py-4">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border p-4">
            <Skeleton className="mb-4 h-4 w-16 rounded-md" />
            <div className="flex items-end gap-2">
              {[45, 70, 55, 85, 60].map((height, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-md"
                  style={{ height: `${height * 0.45}px` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <Skeleton className="mb-4 h-4 w-20 rounded-md" />
            <div className="flex items-center justify-center gap-6 py-4">
              <Skeleton className="size-36 rounded-full" />
              <div className="flex-1 space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5 w-4/5 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="size-2.5 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="h-4 w-2/5 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-md" />
                </div>
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
