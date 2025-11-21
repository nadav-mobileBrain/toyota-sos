export function ColumnSkeleton() {
  return (
    <div className="flex min-w-[320px] shrink-0 flex-col rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse">
      {/* Skeleton Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="space-y-2">
          <div className="h-5 bg-gray-300 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      </div>

      {/* Skeleton Tasks */}
      <div className="flex-1 space-y-3 p-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-white p-3 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    </div>
  );
}


