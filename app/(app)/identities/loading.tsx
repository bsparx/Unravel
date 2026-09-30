import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12" role="status" aria-label="Loading identities">
      <span className="sr-only">Loading identities</span>
      <header className="mb-8 space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </header>
      <div className="mb-8 flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-border bg-card space-y-5 rounded-[20px] border p-5 sm:p-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-full max-w-sm" />
            </div>
            <Skeleton className="h-5 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-28 rounded-lg" />
              <Skeleton className="h-11 w-32 rounded-lg" />
            </div>
            <div className="border-border border-t pt-2">
              <Skeleton className="h-11 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
