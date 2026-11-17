import { Skeleton } from "@/components/ui/skeleton";

/** Two weeks of placeholder bars, uneven so they read as data. */
const BAR_HEIGHTS = [40, 62, 18, 75, 55, 8, 68, 80, 30, 58, 72, 12, 64, 50];

/**
 * The Body page's outline while it loads: the header, the tab pill, and a
 * tall block that stands in for either tab. The tab isn't known here, so the
 * block is the shape both share (a wide card first) rather than a guess at
 * one tab's details.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise">
        <header className="mb-8 space-y-3">
          <Skeleton className="h-12 w-36 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        </header>

        <Skeleton className="mb-10 h-10 w-52 rounded-full" />

        <div className="max-w-4xl space-y-10">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-8 w-56 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-8 rounded-2xl border p-6 md:flex-row md:p-10">
            <Skeleton className="size-[min(232px,70vw)] shrink-0 rounded-full" />
            <div className="w-full space-y-4">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-7 w-full max-w-md rounded-md" />
              <Skeleton className="h-7 w-2/3 max-w-sm rounded-md" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>
          <div className="flex h-28 items-end gap-1.5">
            {BAR_HEIGHTS.map((height, day) => (
              <Skeleton key={day} className="flex-1 rounded-md" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
