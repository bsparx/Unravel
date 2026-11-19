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
      {/* Shaped like a tab: the scene, its strip, then the tab's own card. */}
      <div className="space-y-6">
        <Skeleton className="aspect-[16/9] w-full rounded-3xl sm:aspect-[2/1] lg:aspect-[21/9]" />
        <div className="flex gap-1.5">
          {Array.from({ length: 14 }, (_, index) => (
            <Skeleton key={index} className="size-4 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}
