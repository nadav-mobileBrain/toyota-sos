'use client';

export function TaskSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="h-5 w-12 rounded bg-gray-200" />
        <span className="h-5 w-16 rounded bg-gray-200" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}


