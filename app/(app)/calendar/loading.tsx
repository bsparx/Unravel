import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full px-4 py-6 md:px-6 md:py-8" role="status" aria-label="Loading calendar">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <Skeleton className="h-11 w-14 rounded-[10px]" />
              <Skeleton className="h-11 w-14 rounded-[10px]" />
            </div>
            <Skeleton className="h-11 w-36 rounded-[13px]" />
            <Skeleton className="h-11 w-24 rounded-[10px]" />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {/* The grid — day view with the right panel collapsed by default. */}
          <div className="bg-card overflow-hidden rounded-[20px] border">
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
        </div>
      </div>
    </div>
  );
}
