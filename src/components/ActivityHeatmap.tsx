"use client";

import { useMemo, useState } from "react";

export type DailyActivityMap = Record<string, { count: number; acCount: number }>;

interface ActivityHeatmapProps {
  data: DailyActivityMap;
  totalSubmissionsInYear: number;
  currentStreak: number;
  longestStreak: number;
  className?: string;
}

export function ActivityHeatmap({
  data,
  totalSubmissionsInYear,
  currentStreak,
  longestStreak,
  className = "",
}: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<{
    formattedDate: string;
    count: number;
    acCount: number;
    x: number;
    y: number;
  } | null>(null);

  const { weeks, monthLabels, activeDaysCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDayOfWeek = today.getDay();
    const daysToSunday = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysToSunday);

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 52 * 7 + 1);

    const generatedWeeks: Array<
      Array<{
        date: Date;
        dateStr: string;
        count: number;
        acCount: number;
        isFuture: boolean;
        isToday: boolean;
      }>
    > = [];

    const months: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;
    let activeDays = 0;

    const curr = new Date(startDate);
    for (let w = 0; w < 52; w++) {
      const week: (typeof generatedWeeks)[0] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = curr.toISOString().split("T")[0];
        const isFuture = curr > today;
        const isToday =
          curr.getDate() === today.getDate() &&
          curr.getMonth() === today.getMonth() &&
          curr.getFullYear() === today.getFullYear();

        const entry = data[dateStr] || { count: 0, acCount: 0 };
        if (!isFuture && entry.count > 0) activeDays++;

        if (d === 0) {
          const currentMonth = curr.getMonth();
          if (currentMonth !== lastMonth) {
            months.push({ label: `Th${currentMonth + 1}`, weekIndex: w });
            lastMonth = currentMonth;
          }
        }

        week.push({
          date: new Date(curr),
          dateStr,
          count: isFuture ? 0 : entry.count,
          acCount: isFuture ? 0 : entry.acCount,
          isFuture,
          isToday,
        });

        curr.setDate(curr.getDate() + 1);
      }
      generatedWeeks.push(week);
    }

    return { weeks: generatedWeeks, monthLabels: months, activeDaysCount: activeDays };
  }, [data]);

  function getLevel(count: number, acCount: number, isFuture: boolean) {
    if (isFuture) return "bg-transparent border border-dashed border-[var(--line)]/20 opacity-20 cursor-default";
    if (count === 0) return "bg-[var(--line)]/25 hover:bg-[var(--line)]/50";
    if (acCount > 0 && count >= 8) return "bg-emerald-400 text-white shadow-sm shadow-emerald-400/40 ring-1 ring-emerald-300";
    if (count >= 6) return "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30";
    if (count >= 3) return "bg-emerald-600/80 text-white";
    return "bg-emerald-800/60 text-emerald-200";
  }

  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)]/50 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🟩</span>
            <h2 className="text-base sm:text-lg font-bold text-[var(--navy)]">
              Biểu đồ đóng góp & nộp bài
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Hoạt động giải bài tập và nộp bài trong 52 tuần gần nhất
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)]/60 bg-[var(--background)]/60 px-2.5 py-1.5">
            <span className="text-amber-500 text-sm">🔥</span>
            <span>Chuỗi: <strong className="text-[var(--navy)]">{currentStreak} ngày</strong></span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)]/60 bg-[var(--background)]/60 px-2.5 py-1.5">
            <span className="text-yellow-500 text-sm">⭐</span>
            <span>Kỷ lục: <strong className="text-[var(--navy)]">{longestStreak} ngày</strong></span>
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="inline-block min-w-[700px] select-none">
          <div className="relative mb-2 h-4 text-[10px] font-medium text-[var(--muted)]">
            {monthLabels.map(({ label, weekIndex }) => (
              <span key={`${label}-${weekIndex}`} className="absolute" style={{ left: `${weekIndex * 13.5 + 24}px` }}>
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            <div className="flex flex-col justify-between pr-1.5 text-[10px] font-medium text-[var(--muted)] leading-[11px] py-0.5">
              <span>T2</span>
              <span>T4</span>
              <span>T6</span>
              <span>CN</span>
            </div>

            <div className="flex gap-1">
              {weeks.map((week, wIndex) => (
                <div key={wIndex} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <button
                      key={day.dateStr}
                      type="button"
                      disabled={day.isFuture}
                      onMouseEnter={(e) => {
                        if (day.isFuture) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHovered({
                          formattedDate: day.date.toLocaleDateString("vi-VN", {
                            weekday: "short",
                            day: "numeric",
                            month: "numeric",
                            year: "numeric",
                          }),
                          count: day.count,
                          acCount: day.acCount,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      className={`size-2.5 sm:size-3 rounded-[2px] transition-all duration-150 ${getLevel(day.count, day.acCount, day.isFuture)} ${
                        day.isToday ? "ring-2 ring-[var(--teal)] ring-offset-1 ring-offset-[var(--paper)]" : ""
                      }`}
                      aria-label={`${day.dateStr}: ${day.count} bài`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs text-[var(--cream)] shadow-xl"
          style={{ left: `${hovered.x}px`, top: `${hovered.y - 8}px` }}
        >
          <div className="font-semibold text-white">{hovered.formattedDate}</div>
          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
            {hovered.count === 0 ? "Không có bài nộp" : (
              <>
                <span className="font-semibold text-[var(--teal)]">{hovered.count}</span> bài nộp
                {hovered.acCount > 0 && <span className="text-emerald-400 font-medium"> ({hovered.acCount} AC)</span>}
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)]/40 pt-3 text-xs text-[var(--muted)]">
        <div className="flex items-center gap-3">
          <span>Tổng: <strong className="text-[var(--navy)]">{totalSubmissionsInYear.toLocaleString("vi-VN")}</strong> lượt</span>
          <span>Hoạt động: <strong className="text-[var(--navy)]">{activeDaysCount}</strong>/365 ngày</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">Ít</span>
          <span className="size-2.5 rounded-[2px] bg-[var(--line)]/25" />
          <span className="size-2.5 rounded-[2px] bg-emerald-800/60" />
          <span className="size-2.5 rounded-[2px] bg-emerald-600/80" />
          <span className="size-2.5 rounded-[2px] bg-emerald-500" />
          <span className="size-2.5 rounded-[2px] bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span className="text-[10px]">Nhiều</span>
        </div>
      </div>
    </div>
  );
}