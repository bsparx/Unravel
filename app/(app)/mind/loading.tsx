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
      <div className="mb-8 flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className={index % 2 ? "h-64 rounded-md" : "h-72 rounded-md"}
          />
        ))}
      </div>
    </div>
  );
}
