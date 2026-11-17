import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the notebook: a cover and its details, then the paper. */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12"
      role="status"
      aria-label="Loading the book"
    >
      <span className="sr-only">Loading the book</span>
      <Skeleton className="mb-8 h-5 w-20" />
      <div className="grid gap-8 sm:grid-cols-[13rem_1fr] sm:items-end md:gap-12">
        <Skeleton className="mx-auto aspect-[2/3] w-40 rounded-[2px_6px_6px_2px] sm:w-full" />
        <div className="space-y-4">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-2 w-full max-w-md rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>
      <div className="mx-auto mt-14 max-w-3xl space-y-8">
        <Skeleton className="h-40 rounded-md" />
        <Skeleton className="h-72 rounded-md" />
      </div>
    </div>
  );
}
