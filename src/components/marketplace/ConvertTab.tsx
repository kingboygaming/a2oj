"use client";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export function ConvertTab({
  points,
  pointsToConvert,
  onPointsChange,
  onConvert,
  isConverting,
}: {
  points: number;
  pointsToConvert: number;
  onPointsChange: (val: number) => void;
  onConvert: () => void;
  isConverting: boolean;
}) {
  const receivedCoins = pointsToConvert * 10;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card variant="glass" className="p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-3xl shadow-lg shadow-amber-500/20 mb-3">
            🪙
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--navy)]">
            Quy Đổi Điểm Chuyên Cần ➔ A2 Coin
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Tỉ lệ quy đổi cố định: <strong>1 Điểm chuyên cần = 10 A2 Coins</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--background)]/60 p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Điểm chuyên cần hiện có:</span>
            <strong className="text-sky-400 font-bold text-sm">{points.toLocaleString("vi-VN")} pts</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
              Số điểm muốn quy đổi:
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max={points}
                value={pointsToConvert}
                onChange={(e) => onPointsChange(Math.max(1, Number(e.target.value)))}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-base font-bold text-[var(--navy)] focus:outline-none focus:border-[var(--teal)]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPointsChange(points)}
                className="text-xs"
              >
                Tất cả
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[10, 50, 100, 500].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onPointsChange(val)}
                className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] hover:text-white hover:border-[var(--teal)] transition-colors"
              >
                +{val}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--line)]/50 pt-3 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Nhận được:</span>
            <div className="flex items-center gap-1.5 text-amber-500 font-black text-xl">
              <span>{receivedCoins.toLocaleString("vi-VN")}</span>
              <span className="text-xs font-bold text-amber-500/70">A2C</span>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full mt-6 py-3 font-bold text-sm shadow-lg shadow-[var(--teal)]/20"
          disabled={isConverting || points < 1 || pointsToConvert > points}
          onClick={onConvert}
        >
          {isConverting ? "Đang quy đổi..." : `Xác nhận đổi sang ${receivedCoins.toLocaleString("vi-VN")} A2C`}
        </Button>
      </Card>
    </div>
  );
}
