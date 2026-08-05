import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-10">
        <header className="space-y-2">
          <Skeleton className="h-12 w-44 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </header>

        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, day) => (
            <div key={day} className="rounded-lg border p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <Skeleton
                  className="h-4 rounded-md"
                  style={{ width: `${50 + (day % 3) * 8}%` }}
                />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: day % 4 === 0 ? 3 : 0 }).map((_, row) => (
                  <Skeleton key={row} className="h-4 w-3/4 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
