// Skeleton hiển thị ngay khi bấm vào bài tập, trong khi server render
export default function Loading() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Left column: problem statement */}
      <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-sm">
        {/* Problem header */}
        <div className="border-b border-[var(--line)] bg-[var(--surface-strong)] px-5 py-5 sm:px-7">
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-md bg-white/20" />
            <div className="h-6 w-16 animate-pulse rounded-md bg-white/20" />
          </div>
          <div className="mt-3 h-8 w-3/4 animate-pulse rounded-lg bg-white/20" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-white/10" />
        </div>

        {/* Problem body */}
        <div className="space-y-3 px-5 py-6 sm:px-7">
          {/* Limits row */}
          <div className="flex gap-4">
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--line)]" />
          </div>
          {/* Description paragraphs */}
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--line)]" />
          </div>
          {/* Sample IO */}
          <div className="mt-6 space-y-3">
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-20 w-full animate-pulse rounded-lg bg-[var(--line)]" />
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-16 w-full animate-pulse rounded-lg bg-[var(--line)]" />
          </div>
        </div>
      </article>

      {/* Right column: submit panel */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-sm">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <div className="h-6 w-32 animate-pulse rounded bg-[var(--line)]" />
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--line)]" />
            <div className="h-48 w-full animate-pulse rounded-xl bg-[var(--line)]" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-[var(--line)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
