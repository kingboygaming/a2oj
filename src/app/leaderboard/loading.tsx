export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-[var(--line)]" />
          <div className="h-7 w-64 animate-pulse rounded-lg bg-[var(--line)]" />
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--line)]" />
        </div>
        <div className="flex gap-2">
          {[80, 90, 72].map((w, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-full bg-[var(--line)]"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Podium skeleton */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 pb-0 pt-6">
        <div className="mb-4 mx-auto h-3 w-32 animate-pulse rounded bg-[var(--line)]" />
        <div className="flex items-end justify-center gap-3">
          {[{ h: "h-24" }, { h: "h-32" }, { h: "h-16" }].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="size-10 animate-pulse rounded-full bg-[var(--line)]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--line)]" />
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--line)]" />
              <div className={`w-24 animate-pulse rounded-t-lg bg-[var(--line)] ${item.h}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Search skeleton */}
      <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--line)]" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="border-b border-[var(--line)] bg-[var(--surface-strong)] px-5 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--line)]" />
        </div>
        <div>
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--line)] px-5 py-3 last:border-0"
              style={{ opacity: 1 - i * 0.03 }}
            >
              <div className="size-7 animate-pulse rounded-full bg-[var(--line)]" />
              <div className="flex items-center gap-2.5">
                <div className="size-8 animate-pulse rounded-full bg-[var(--line)]" />
                <div className="space-y-1">
                  <div className="h-4 w-28 animate-pulse rounded bg-[var(--line)]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-[var(--line)]" />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="h-4 w-12 animate-pulse rounded bg-[var(--line)]" />
                <div className="h-1.5 w-24 animate-pulse rounded-full bg-[var(--line)]" />
                <div className="h-4 w-12 animate-pulse rounded bg-[var(--line)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
