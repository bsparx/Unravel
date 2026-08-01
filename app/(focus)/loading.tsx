import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <div className="animate-rise space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-10 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>

        <Skeleton className="h-28 w-full rounded-xl" />

        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>

        <div className="flex gap-5 pt-1">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}
