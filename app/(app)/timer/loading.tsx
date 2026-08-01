import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="animate-rise flex w-full max-w-sm flex-col items-center gap-8">
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-5 w-48 rounded-md" />
          <Skeleton className="mx-auto h-4 w-32 rounded-md" />
        </div>

        {/* The face: a ring with a hollow centre, so the page never jumps. */}
        <div className="relative size-[260px]">
          <Skeleton className="absolute inset-0 rounded-full" />
          <div className="bg-background absolute inset-4 rounded-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>

        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
    </div>
  );
}
