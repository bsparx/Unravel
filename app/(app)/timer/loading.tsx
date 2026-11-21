import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-6 md:px-6 md:py-10">
      <div className="mb-5 flex w-full items-center justify-between">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>

      <div className="animate-rise flex w-full flex-col items-center rounded-[28px] border border-[var(--card-edge)] bg-card px-5 py-7 shadow-[var(--card-shadow)] sm:px-10 sm:py-9">
        <div className="mb-5 space-y-2 text-center">
          <Skeleton className="mx-auto h-4 w-28 rounded-md" />
          <Skeleton className="mx-auto h-8 w-52 rounded-md" />
        </div>

        {/* The face: a ring with a hollow centre, so the page never jumps. */}
        <div className="relative aspect-square w-full max-w-[356px]">
          <Skeleton className="absolute inset-0 rounded-full" />
          <div className="bg-card absolute inset-[10%] rounded-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Skeleton className="h-12 w-32 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
        </div>

        <Skeleton className="mt-6 h-12 w-40 rounded-xl" />

        <div className="mt-7 flex w-full flex-col items-center gap-4 border-t border-border/50 pt-6">
          <div className="flex flex-wrap justify-center gap-2">
            <Skeleton className="h-11 w-24 rounded-lg" />
            <Skeleton className="h-11 w-32 rounded-lg" />
            <Skeleton className="h-11 w-20 rounded-lg" />
            <Skeleton className="h-11 w-24 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-16 rounded-lg" />
            <Skeleton className="h-11 w-16 rounded-lg" />
            <Skeleton className="h-11 w-16 rounded-lg" />
            <Skeleton className="h-11 w-16 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
