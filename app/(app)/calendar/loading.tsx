import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <Skeleton className="h-7 w-12 rounded-full" />
              <Skeleton className="h-7 w-12 rounded-full" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* The grid — day view is the default, so one wide column. */}
          <div className="bg-card overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b">
              <div />
              <div className="space-y-1.5 border-l px-2 pt-2 pb-1.5 text-center">
                <Skeleton className="mx-auto h-3 w-10 rounded-md" />
                <Skeleton className="mx-auto size-7 rounded-full" />
                <Skeleton className="mx-auto h-1.5 w-3/4 rounded-full" />
              </div>
            </div>

            <div className="grid h-[360px] grid-cols-[3.5rem_minmax(0,1fr)]">
              <div className="relative">
                {[120, 240, 360, 480, 600].map((top) => (
                  <Skeleton
                    key={top}
                    className="absolute right-2 h-3 w-10 rounded-md"
                    style={{ top }}
                  />
                ))}
              </div>
              <div className="relative border-l">
                {Array.from({ length: 12 }).map((_, line) => (
                  <Skeleton
                    key={line}
                    className="absolute inset-x-0 h-px"
                    style={{ top: line * 30 }}
                  />
                ))}
                <Skeleton
                  className="absolute inset-x-2 top-[90px] h-16 rounded-md"
                  style={{ opacity: 0.85 }}
                />
                <Skeleton
                  className="absolute inset-x-2 top-[190px] h-9 rounded-md"
                  style={{ opacity: 0.65 }}
                />
                <Skeleton
                  className="absolute inset-x-2 top-[260px] h-20 rounded-md"
                  style={{ opacity: 0.85 }}
                />
                <Skeleton
                  className="absolute inset-x-2 top-[350px] h-7 rounded-md"
                  style={{ opacity: 0.6 }}
                />
              </div>
            </div>
          </div>

          {/* The scheduling panel */}
          <aside className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-3 w-14 rounded-md" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="-mx-2 flex items-start gap-2 rounded-md border-b px-2 py-2"
                >
                  <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
                </div>
              ))}

              <Skeleton className="h-3 w-16 rounded-md pt-1" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="-mx-2 flex items-start gap-2 rounded-md border-b px-2 py-2"
                >
                  <Skeleton className="mt-1 size-4 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5 rounded-md" />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
