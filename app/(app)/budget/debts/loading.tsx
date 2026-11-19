import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-full rounded-md" />
      </header>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="grid border-t lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 p-4">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
