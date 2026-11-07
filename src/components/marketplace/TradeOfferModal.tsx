"use client";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { MarketListingView, OwnedCardView } from "./types";

export function TradeOfferModal({
  tradeTargetListing,
  myCards,
  offeredCardId,
  onOfferedCardChange,
  offeredCoins,
  onOfferedCoinsChange,
  tradeMessage,
  onTradeMessageChange,
  onClose,
  onSubmit,
  isSubmitting,
  coins,
}: {
  tradeTargetListing: MarketListingView | null;
  myCards: OwnedCardView[];
  offeredCardId: string;
  onOfferedCardChange: (val: string) => void;
  offeredCoins: number;
  onOfferedCoinsChange: (val: number) => void;
  tradeMessage: string;
  onTradeMessageChange: (val: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  coins: number;
}) {
  if (!tradeTargetListing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
      <Card variant="glass" className="w-full max-w-lg p-6">
        <h3 className="text-lg font-bold text-[var(--navy)]">
          Đề nghị đổi lấy: {tradeTargetListing.card.name}
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Chọn một thẻ từ kho của bạn để gửi đề nghị trao đổi tới @{tradeTargetListing.seller.username}.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Chọn thẻ bài của bạn đem đổi
            </label>
            <select
              value={offeredCardId}
              onChange={(e) => onOfferedCardChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--navy)]"
            >
              <option value="">-- Chọn một thẻ bài --</option>
              {myCards.map((item) => (
                <option key={item.card.id} value={item.card.id}>
                  [{item.card.rarity}] {item.card.name} (Có {item.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Đính kèm thêm A2 Coin (Tuỳ chọn)
            </label>
            <input
              type="number"
              min="0"
              max={coins}
              value={offeredCoins}
              onChange={(e) => onOfferedCoinsChange(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Lời nhắn
            </label>
            <input
              type="text"
              placeholder="Mình đổi thẻ này được không bạn?"
              value={tradeMessage}
              onChange={(e) => onTradeMessageChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)]/50 pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!offeredCardId || isSubmitting}
          >
            {isSubmitting ? "Đang gửi..." : "Gửi Đề Nghị Đổi"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
