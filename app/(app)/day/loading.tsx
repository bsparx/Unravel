import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </header>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-1.5 flex justify-between">
            <Skeleton className="h-3 w-8 rounded-md" />
            <Skeleton className="h-3 w-8 rounded-md" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-5 w-48 rounded-md" />
          </div>
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>

        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton
                  className="h-4 rounded-md"
                  style={{ width: `${72 - (i % 3) * 14}%` }}
                />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
