"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!tradeTargetListing) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [tradeTargetListing, isSubmitting, onClose]);

  if (!tradeTargetListing || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="relative my-auto w-full max-w-lg">
        <Card variant="glass" className="w-full p-6 shadow-2xl border-white/20">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-lg font-bold text-[var(--navy)]">
                Đề nghị đổi lấy: {tradeTargetListing.card.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Chọn một thẻ từ kho của bạn để gửi đề nghị trao đổi tới @{tradeTargetListing.seller.username}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--navy)] transition-colors text-xl leading-none"
              aria-label="Đóng"
            >
              &times;
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Chọn thẻ bài của bạn đem đổi
              </label>
              <select
                value={offeredCardId}
                onChange={(e) => onOfferedCardChange(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--navy)] focus:outline-none focus:border-[var(--teal)]"
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
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:border-[var(--teal)] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Lời nhắn cho người bán
              </label>
              <input
                type="text"
                placeholder="Mình đổi thẻ này được không bạn?"
                value={tradeMessage}
                onChange={(e) => onTradeMessageChange(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:border-[var(--teal)]"
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
    </div>,
    document.body
  );
}

