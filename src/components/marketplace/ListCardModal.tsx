"use client";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { OwnedCardView } from "./types";

export function ListCardModal({
  selectedCardToList,
  listPriceCoins,
  onListPriceChange,
  listNotes,
  onListNotesChange,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  selectedCardToList: OwnedCardView | null;
  listPriceCoins: number;
  onListPriceChange: (val: number) => void;
  listNotes: string;
  onListNotesChange: (val: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  if (!selectedCardToList) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <Card variant="glass" className="w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-[var(--navy)]">
          Đăng bán: {selectedCardToList.card.name}
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Thẻ sẽ được niêm yết lên chợ công khai để các bạn khác mua bằng A2 Coin.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Giá bán (A2 Coin)
            </label>
            <input
              type="number"
              min="1"
              max="1000000"
              value={listPriceCoins}
              onChange={(e) => onListPriceChange(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Ghi chú cho người mua (Tuỳ chọn)
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="Thẻ trùng cần bán nhanh..."
              value={listNotes}
              onChange={(e) => onListNotesChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)]/50 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Huỷ
          </Button>
          <Button variant="primary" size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Đang xử lý..." : "Xác nhận niêm yết"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
