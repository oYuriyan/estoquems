export function SkeletonLoader() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] p-6 overflow-hidden">
      <div className="h-16 w-full max-w-7xl mx-auto bg-slate-200/50 dark:bg-slate-800/50 rounded-xl mb-8 animate-shimmer" />
      <div className="flex flex-1 gap-6 max-w-7xl w-full mx-auto">
        <div className="w-64 hidden md:block rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50" />
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex gap-4 mb-4">
            <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50" />
            <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50" />
            <div className="h-24 flex-1 rounded-xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl animate-shimmer bg-slate-200/50 dark:bg-slate-800/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
