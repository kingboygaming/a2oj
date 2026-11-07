"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedCardToList) return;
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
  }, [selectedCardToList, isSubmitting, onClose]);

  if (!selectedCardToList || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="relative my-auto w-full max-w-md">
        <Card variant="glass" className="w-full p-6 shadow-2xl border-white/20">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-lg font-bold text-[var(--navy)]">
                Đăng bán: {selectedCardToList.card.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Thẻ sẽ được niêm yết lên chợ công khai để các bạn khác mua bằng A2 Coin.
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
                Giá bán (A2 Coin)
              </label>
              <input
                type="number"
                min="1"
                max="1000000"
                value={listPriceCoins}
                onChange={(e) => onListPriceChange(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:border-[var(--teal)] font-mono"
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
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:border-[var(--teal)]"
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
    </div>,
    document.body
  );
}

