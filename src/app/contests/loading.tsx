// Skeleton hiển thị ngay khi navigate tới /contests
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-[var(--line)]" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--line)]" />
      </div>

      {/* Contest cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-6 w-2/3 animate-pulse rounded-lg bg-[var(--line)]" />
              <div className="flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--line)]" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--line)]" />
              </div>
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--line)]" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--line)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
