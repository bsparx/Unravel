import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-12" role="status" aria-label="Loading habits">
      <span className="sr-only">Loading your habits.</span>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-5 w-64 max-w-full rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-lg" />
          <Skeleton className="h-11 w-28 rounded-lg" />
        </div>
      </header>

      <Skeleton className="mb-4 h-7 w-36 rounded-md" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, habit) => (
          <div key={habit} className="border-border bg-card rounded-[1.25rem] border p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32 max-w-full rounded-md" />
                <Skeleton className="h-6 w-40 max-w-full rounded-md" />
              </div>
              <div className="flex shrink-0 gap-1">
                <Skeleton className="h-11 w-16 rounded-lg" />
                <Skeleton className="h-11 w-16 rounded-lg" />
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <Skeleton className="mt-1 size-5 shrink-0 rounded-[7px]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-52 max-w-full rounded-md" />
                <Skeleton className="h-4 w-40 max-w-full rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-5 ml-8 h-4 w-32 rounded-md" />
            <Skeleton className="mt-6 h-11 w-40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
