import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-md" />
        </header>

        <div className="rounded-lg border p-5">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
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
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}
