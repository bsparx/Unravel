import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-12" aria-busy="true" aria-label="Loading treats and chapters">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-2.5">
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    </div>
  );
}
