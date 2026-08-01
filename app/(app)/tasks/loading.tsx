import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-4 w-60 rounded-md" />
        </header>

        <div className="flex gap-1">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>

        <div className="space-y-1">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group}>
              <Skeleton className="mb-1 h-3 w-20 rounded-md" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg p-2"
                >
                  <Skeleton className="size-5 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton
                      className="h-4 rounded-md"
                      style={{ width: `${80 - ((group * 4 + i) % 3) * 15}%` }}
                    />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="size-4 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
