// Skeleton cho bảng xếp hạng contest
export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="h-7 w-48 animate-pulse rounded-lg bg-[var(--line)]" />

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-sm">
        {/* Table header */}
        <div className="flex gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3">
          <div className="h-4 w-8 animate-pulse rounded bg-[var(--line)]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--line)]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-16 animate-pulse rounded bg-[var(--line)]" />
          ))}
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--line)] ml-auto" />
        </div>
        {/* Rows */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-3 last:border-0"
            style={{ opacity: 1 - i * 0.05 }}
          >
            <div className="h-4 w-8 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--line)]" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 w-16 animate-pulse rounded bg-[var(--line)]" />
            ))}
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--line)] ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
