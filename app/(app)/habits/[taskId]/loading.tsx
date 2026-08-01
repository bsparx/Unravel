import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-10 w-44 rounded-lg" />
          <Skeleton className="h-4 w-60 rounded-md" />
        </header>

        <div className="rounded-lg border p-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }).map((_, day) => (
                <Skeleton key={day} className="size-9 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14 rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14 rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Skeleton className="h-3 w-24 rounded-md" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-14 rounded-md" />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}
