import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-8">
        <header className="space-y-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </header>

        <div className="relative h-56 w-full md:h-64">
          <Skeleton className="absolute inset-0 rounded-xl" />
          <Skeleton className="absolute top-1/4 left-1/2 h-px w-16" />
          <div className="absolute inset-x-10 bottom-4 flex items-end justify-between">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="mb-2 size-3 rounded-full" />
            <Skeleton className="mb-1 size-5 rounded-full" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
