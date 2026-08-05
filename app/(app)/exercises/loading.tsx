import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-12">
        <header className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-md" />
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

        {/* The two figures, and the exercises they point at. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="mx-auto aspect-[200/460] w-full max-w-[15rem] rounded-lg" />
              <Skeleton className="mx-auto aspect-[200/460] w-full max-w-[15rem] rounded-lg" />
            </div>
          </div>
          <div className="mt-8 space-y-5 lg:mt-0">
            <Skeleton className="h-8 w-52 rounded-lg" />
            <Skeleton className="h-9 w-full max-w-md rounded-md" />
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {Array.from({ length: 6 }).map((_, card) => (
                <Skeleton key={card} className="h-28 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
