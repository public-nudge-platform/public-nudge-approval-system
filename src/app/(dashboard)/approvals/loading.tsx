import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-7 w-24" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center justify-between flex-shrink-0 sm:flex-col sm:items-end sm:gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
