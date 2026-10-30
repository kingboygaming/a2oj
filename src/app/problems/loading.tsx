// Skeleton hiển thị ngay khi navigate tới /problems, trong khi server đang fetch data
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--line)]" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--line)]" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--line)]" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-[var(--line)]" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--line)]" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
        {/* Table header */}
        <div className="flex gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3">
          <div className="h-4 w-12 animate-pulse rounded bg-[var(--line)]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-[var(--line)]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[var(--line)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--line)]" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-4 last:border-0"
            style={{ opacity: 1 - i * 0.06 }}
          >
            <div className="h-4 w-12 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 flex-1 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--line)]" />
            <div className="h-4 w-14 animate-pulse rounded bg-[var(--line)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
