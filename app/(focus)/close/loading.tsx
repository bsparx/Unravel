import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-6 py-24">
      <div className="animate-rise space-y-4 text-center">
        <Skeleton className="mx-auto h-4 w-32 rounded-md" />
        <Skeleton className="mx-auto h-9 w-3/4 rounded-lg" />
        <Skeleton className="mx-auto h-4 w-1/2 rounded-md" />

        <div className="mx-auto mt-8 space-y-2">
          <Skeleton className="mx-auto h-12 w-full rounded-lg" />
        </div>

        <div className="mx-auto flex justify-center gap-2 pt-4">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}
