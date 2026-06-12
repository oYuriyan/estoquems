export function SkeletonLoader() {
  return (
    <div className="h-screen w-full flex bg-slate-50 dark:bg-[#0f172a] overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="w-64 hidden md:flex flex-col border-r border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] shrink-0 p-5">
        <div className="h-8 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer mb-8" />
        <div className="space-y-3 flex-1">
          <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
        </div>
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Skeleton */}
        <div className="h-16 border-b border-slate-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] px-6 flex items-center justify-between shrink-0">
          <div className="h-6 w-32 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          <div className="h-9 w-64 rounded-lg bg-slate-200 dark:bg-slate-800 animate-shimmer" />
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#f1f5f9] dark:bg-[#0d1117]">
          <div className="flex gap-4">
            <div className="h-24 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800 animate-shimmer" />
            <div className="h-24 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800 animate-shimmer" />
            <div className="h-24 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800 animate-shimmer" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#30363d] p-6 flex flex-col h-[280px]">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer mb-3" />
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer mb-4" />
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer mb-6" />
                
                <div className="space-y-3 mb-auto">
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
                  <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
                  <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
                  <div className="h-6 w-12 bg-indigo-100 dark:bg-indigo-900/30 rounded animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
