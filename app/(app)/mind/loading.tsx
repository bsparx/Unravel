import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12"
      role="status"
      aria-label="Loading Mind"
    >
      <span className="sr-only">Loading Mind</span>
      <header className="mb-8 space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-full max-w-sm" />
      </header>
      <Skeleton className="mb-8 h-10 w-full max-w-md rounded-full" />
      {/* Shaped like the first tab most days: today's page, then the dots. */}
      <div className="mx-auto max-w-2xl space-y-10">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <div className="flex gap-1.5">
          {Array.from({ length: 14 }, (_, index) => (
            <Skeleton key={index} className="size-4 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
