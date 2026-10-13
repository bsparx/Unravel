import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-52 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-md" />
          </div>
          <Skeleton className="h-9 w-20 rounded-md" />
        </header>

        {[3, 4].map((count, group) => (
          <div key={group} className="border-border rounded-lg border">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-5 w-32 rounded-md" />
            </div>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-36 rounded-md" />
                  <Skeleton className="h-3 w-48 rounded-md" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="ml-auto h-5 w-20 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
