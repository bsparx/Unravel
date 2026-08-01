import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </header>

        <div className="space-y-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="-mx-2 flex items-center gap-3 rounded-md border-b px-2 py-3"
            >
              <Skeleton className="size-5 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton
                  className="h-4 rounded-md"
                  style={{ width: `${70 - (i % 3) * 12}%` }}
                />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="size-4 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
