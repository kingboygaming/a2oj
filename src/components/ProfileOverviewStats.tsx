import { Card } from "@/components/Card";

interface ProfileOverviewStatsProps {
  totalSolved: number;
  totalSubmissions: number;
  currentStreak: number;
  activityPoints: number;
  a2Coins?: number;
  className?: string;
}

export function ProfileOverviewStats({
  totalSolved,
  totalSubmissions,
  currentStreak,
  activityPoints,
  a2Coins = 0,
  className = "",
}: ProfileOverviewStatsProps) {
  const acRate =
    totalSubmissions > 0
      ? Math.round((totalSolved / totalSubmissions) * 100)
      : 0;

  return (
    <div className={`grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5 ${className}`}>
      {/* 1. AC Problems */}
      <Card
        hover
        variant="glass"
        className="group relative overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Bài đã AC
          </span>
          <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-bold shadow-inner">
            ✓
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors tabular-nums">
          {totalSolved.toLocaleString("vi-VN")}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Tỉ lệ AC: <strong className="text-emerald-400 font-semibold">{acRate}%</strong>
        </p>
      </Card>

      {/* 2. Total Submissions */}
      <Card
        hover
        variant="glass"
        className="group relative overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Tổng bài nộp
          </span>
          <span className="flex size-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 text-sm font-bold shadow-inner">
            ⚡
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-[var(--navy)] group-hover:text-[var(--teal)] transition-colors tabular-nums">
          {totalSubmissions.toLocaleString("vi-VN")}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Lượt gửi lên Judge</p>
      </Card>

      {/* 3. Streak */}
      <Card
        hover
        variant="glass"
        className="group relative overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Chuỗi code
          </span>
          <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 text-sm font-bold shadow-inner animate-pulse">
            🔥
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-amber-500 tabular-nums">
          {currentStreak}{" "}
          <span className="text-sm font-medium text-[var(--muted)]">ngày</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Liên tiếp có bài nộp</p>
      </Card>

      {/* 4. A2 Coin */}
      <Card
        hover
        variant="glass"
        className="group relative overflow-hidden p-4 sm:p-5 border-amber-500/30"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Ví A2 Coin
          </span>
          <span className="flex size-8 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-xs shadow-md">
            A2
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-black text-amber-500 tabular-nums">
          {a2Coins.toLocaleString("vi-VN")}
        </div>
        <p className="mt-1 text-xs text-amber-500/70">Tiền tệ Marketplace & Shop</p>
      </Card>

      {/* 5. Attendance Points */}
      <Card
        hover
        variant="glass"
        className="group relative overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Điểm chuyên cần
          </span>
          <span className="flex size-8 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-400 text-sm font-bold shadow-inner">
            🪙
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-yellow-500 tabular-nums">
          {activityPoints.toLocaleString("vi-VN")}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Đổi sang A2 Coin (1:10)</p>
      </Card>
    </div>
  );
}