import { Badge } from "@/components/Badge";

export type SkillCategory = {
  key: string;
  name: string;
  icon: string;
  solvedCount: number;
  totalAvailable: number;
  color: string; // Tailwind color class for progress bar
  bgGradient: string;
};

interface SkillDistributionProps {
  categories: SkillCategory[];
  totalSolved: number;
  className?: string;
}

export function SkillDistribution({
  categories,
  totalSolved,
  className = "",
}: SkillDistributionProps) {
  // Sort by solved count descending
  const sorted = [...categories].sort((a, b) => b.solvedCount - a.solvedCount);

  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/50 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">📊</span>
            <h2 className="text-base sm:text-lg font-bold text-[var(--navy)]">
              Phân bố kỹ năng thuật toán
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Thống kê các dạng bài và chủ đề đã giải thành công
          </p>
        </div>
        <Badge variant="teal" size="sm">
          {totalSolved} bài đã AC
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map((cat) => {
          const percentOfSolved =
            totalSolved > 0
              ? Math.round((cat.solvedCount / totalSolved) * 100)
              : 0;
          const percentOfTopic =
            cat.totalAvailable > 0
              ? Math.min(
                  100,
                  Math.round((cat.solvedCount / cat.totalAvailable) * 100)
                )
              : 0;

          return (
            <div
              key={cat.key}
              className="group rounded-xl border border-[var(--line)]/50 bg-[var(--background)]/40 p-3.5 transition-all hover:border-[var(--teal)]/40 hover:bg-[var(--background)]/70"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0" aria-hidden="true">
                    {cat.icon}
                  </span>
                  <span className="truncate text-sm font-semibold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors">
                    {cat.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-bold text-[var(--navy)]">
                    {cat.solvedCount}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    /{cat.totalAvailable}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${cat.bgGradient}`}
                  style={{ width: `${percentOfTopic}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span>
                  Hoàn thành:{" "}
                  <strong className="text-[var(--navy)]">{percentOfTopic}%</strong>
                </span>
                <span>
                  Chiếm <strong className="text-[var(--teal)]">{percentOfSolved}%</strong> tổng bài giải
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}