import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </header>

        {/* The quest hero: eyebrow, title, a couple of objectives, a bar. */}
        <div className="rounded-xl border p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-32 rounded-md" />
          </div>
          <Skeleton className="h-6 w-3/5 rounded-lg" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
          <Skeleton className="mt-4 h-0.5 w-full rounded-full" />
        </div>

        {/* The quest log. */}
        <div className="rounded-xl border px-4 py-1.5">
          <div className="flex items-center justify-between py-2">
            <Skeleton className="h-3.5 w-32 rounded-md" />
            <Skeleton className="h-3.5 w-24 rounded-md" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <Skeleton className="size-2.5 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-[6.75rem] shrink-0 rounded-md" />
              <Skeleton
                className="h-4 rounded-md"
                style={{ width: `${52 - (i % 3) * 12}%` }}
              />
              <Skeleton className="ml-auto h-3.5 w-12 shrink-0 rounded-md" />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton
                  className="h-4 rounded-md"
                  style={{ width: `${72 - (i % 3) * 14}%` }}
                />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
