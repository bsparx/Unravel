import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-12">
      <div className="animate-rise space-y-8">
        <header className="space-y-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </header>

        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-4 w-24 rounded-md" />
          <div className="relative h-72 w-44">
            <Skeleton className="absolute inset-0 rounded-[2rem]" />
            <Skeleton
              className="absolute inset-x-3 top-1/2 h-px"
            />
          </div>
          <div className="flex gap-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 rounded-lg border p-4">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <div className="space-y-2 rounded-lg border p-4">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
