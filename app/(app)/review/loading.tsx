import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12" aria-busy="true" aria-label="Loading the weekly review">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <Skeleton className="mt-8 h-96 rounded-[20px]" />
    </div>
  );
}
