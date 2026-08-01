import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-4 w-60 rounded-md" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-5">
            <Skeleton className="mb-3 h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="mt-2 h-3 w-2/3 rounded-md" />
          </div>
          <div className="rounded-lg border p-5">
            <Skeleton className="mb-3 h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="mt-2 h-3 w-2/3 rounded-md" />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Skeleton className="mb-4 h-4 w-36 rounded-md" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 * 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="aspect-square rounded-sm"
                style={{ opacity: 1 - (i % 5) * 0.15 }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton
                className="h-3 w-14 shrink-0 rounded-md"
                style={{ opacity: 1 - (i % 3) * 0.2 }}
              />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-12 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
