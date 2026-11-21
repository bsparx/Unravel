import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-10">
      <div className="animate-rise space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-11 w-24 rounded-xl" />
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-[var(--card-edge)] bg-card p-6 shadow-[var(--card-shadow)]">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="mt-3 h-10 w-36 rounded-md" />
            <Skeleton className="mt-4 h-2 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-48 rounded-md" />
          </div>
          <div className="rounded-[22px] border border-[var(--card-edge)] bg-card p-6 shadow-[var(--card-shadow)]">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="mt-3 h-10 w-32 rounded-md" />
            <Skeleton className="mt-5 h-4 w-52 rounded-md" />
          </div>
        </div>

        <div className="rounded-[26px] border border-[var(--card-edge)] bg-card p-6 shadow-[var(--card-shadow)]">
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-36 rounded-md" />
              <Skeleton className="h-4 w-52 rounded-md" />
            </div>
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>

          <div className="grid grid-cols-7 gap-2.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-14 rounded-xl sm:h-[112px] sm:rounded-2xl"
                style={{ opacity: 1 - (i % 5) * 0.1 }}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-5">
            <Skeleton className="h-9 w-36 rounded-xl" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
