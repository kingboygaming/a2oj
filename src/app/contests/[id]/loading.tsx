// Skeleton cho trang chi tiết contest (overview, problems tab)
export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Contest header card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-sm">
        <div className="border-b border-[var(--line)] bg-[var(--surface-strong)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded-lg bg-white/20" />
              <div className="flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-white/15" />
                <div className="h-5 w-28 animate-pulse rounded-full bg-white/15" />
              </div>
            </div>
            <div className="h-10 w-28 animate-pulse rounded-xl bg-white/20" />
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-6">
            <div className="space-y-1">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--line)]" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-5 w-32 animate-pulse rounded bg-[var(--line)]" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-12 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-5 w-8 animate-pulse rounded bg-[var(--line)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav skeleton */}
      <div className="flex gap-1 border-b border-[var(--line)] pb-0">
        {["Tổng quan", "Bài tập", "Nộp bài", "Bảng xếp hạng"].map((tab) => (
          <div key={tab} className="h-10 w-24 animate-pulse rounded-t-lg bg-[var(--line)]" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-0"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <div className="h-5 w-8 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-5 flex-1 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-5 w-16 animate-pulse rounded bg-[var(--line)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
