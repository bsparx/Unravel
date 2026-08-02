import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-10 w-44 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </header>

        {Array.from({ length: 2 }).map((_, group) => (
          <div key={group} className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="mt-1.5 h-3 w-32 rounded-md" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Skeleton className="size-2.5 rounded-full" />
                  <Skeleton
                    className="h-4 flex-1 rounded-md"
                    style={{ opacity: 1 - (i % 3) * 0.2 }}
                  />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t px-4 py-3">
              <Skeleton className="h-8 w-full rounded-md" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
