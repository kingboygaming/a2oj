"use client";

import { Button } from "@/components/Button";

export function MarketplaceHeader({
  coins,
  points,
  listingsCount,
  inventoryCount,
  activeTab,
  onTabChange,
  onOpenConvert,
}: {
  coins: number;
  points: number;
  listingsCount: number;
  inventoryCount: number;
  activeTab: "market" | "inventory" | "shop" | "convert" | "history";
  onTabChange: (tab: "market" | "inventory" | "shop" | "convert" | "history") => void;
  onOpenConvert: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-6 sm:p-8">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-amber-500/10 pointer-events-none" />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl" aria-hidden="true">🏛️</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
              Sàn giao dịch thẻ &amp; Tiền tệ A2 Coin
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--navy)]">
            Chợ Thẻ Bài &amp; Tiền Tệ A2OJ
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)] max-w-xl">
            Quy đổi Điểm chuyên cần (giải bài AC) sang <strong>A2 Coin</strong> để mua bán thẻ hiếm trên chợ, sắm gói gacha hoặc tách thẻ trùng lấy thêm coin.
          </p>
        </div>

        {/* Wallets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 shadow-lg shadow-amber-500/10">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-white font-black text-sm shadow-md">
              A2
            </span>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                Ví A2 Coin
              </span>
              <strong className="text-xl sm:text-2xl font-black text-amber-500 tabular-nums">
                {coins.toLocaleString("vi-VN")}
              </strong>
              <span className="ml-1 text-xs text-amber-500/70 font-bold">A2C</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
            <span className="text-2xl">🪙</span>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                Điểm chuyên cần
              </span>
              <strong className="text-lg sm:text-xl font-bold text-sky-400 tabular-nums">
                {points.toLocaleString("vi-VN")}
              </strong>
              <span className="ml-1 text-xs text-sky-400/70">pts</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenConvert}
            className="font-bold text-xs shadow-md"
          >
            🔄 Đổi sang A2C
          </Button>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)]/50 pt-5">
        <button
          type="button"
          onClick={() => onTabChange("market")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "market"
              ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
              : "text-[var(--navy)] hover:bg-[var(--background)]"
          }`}
        >
          <span>🏪</span>
          <span>Chợ Thẻ Rao Bán ({listingsCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("inventory")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "inventory"
              ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
              : "text-[var(--navy)] hover:bg-[var(--background)]"
          }`}
        >
          <span>🎴</span>
          <span>Kho Thẻ Của Bạn ({inventoryCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("shop")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "shop"
              ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
              : "text-[var(--navy)] hover:bg-[var(--background)]"
          }`}
        >
          <span>🎁</span>
          <span>Gacha Shop</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("convert")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "convert"
              ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
              : "text-[var(--navy)] hover:bg-[var(--background)]"
          }`}
        >
          <span>🪙</span>
          <span>Đổi Điểm ➔ A2 Coin</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("history")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "history"
              ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
              : "text-[var(--navy)] hover:bg-[var(--background)]"
          }`}
        >
          <span>📜</span>
          <span>Lịch Sử Giao Dịch</span>
        </button>
      </div>
    </div>
  );
}
