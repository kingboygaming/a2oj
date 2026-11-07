"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { RARITY_BADGES } from "./types";

export type UnboxResult = {
  itemName: string;
  packId?: string;
  ticketsAwarded: number;
  awardedCards: Array<{
    id: string;
    name: string;
    rarity: string;
    description?: string;
    attack?: number;
    defense?: number;
    element?: string;
    icon?: string;
    imageUrl?: string | null;
  }>;
};

export function GiftUnboxModal({
  result,
  onClose,
  onGoToInventory,
}: {
  result: UnboxResult | null;
  onClose: () => void;
  onGoToInventory: () => void;
}) {
  const [isOpened, setIsOpened] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!result) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [result]);

  if (!result || !mounted) return null;

  const boxIcons: Record<string, string> = {
    single_ticket: "🎫",
    starter_bundle: "🎒",
    booster_box: "📦",
    exclusive_legendary: "👑",
  };
  const icon = (result.packId && boxIcons[result.packId]) || "🎁";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md animate-in fade-in-0 duration-200">
      <div className="relative my-auto w-full max-w-lg">
        <Card
          variant="glass"
          className="relative w-full overflow-hidden border-2 border-amber-500/40 p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/10"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-purple-500/10 pointer-events-none" />

          {!isOpened ? (
            <div className="relative z-10 py-4 space-y-6">
              <div className="space-y-2">
                <Badge variant="warning" size="md" className="font-bold">
                  PHẦN THƯỞNG MỚI ĐỔI
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-black text-[var(--navy)]">
                  {result.itemName}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Bạn đã đổi thành công gói quà. Nhấn nút bên dưới để mở hộp và khám phá vật phẩm!
                </p>
              </div>

              <div className="relative my-8 flex justify-center">
                <div className="absolute size-32 rounded-full bg-amber-500/25 blur-2xl animate-pulse" />
                <div className="relative flex size-28 sm:size-32 items-center justify-center rounded-3xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-500/30 via-[var(--paper)] to-amber-900/40 text-6xl sm:text-7xl shadow-2xl shadow-amber-500/30 hover:scale-105 transition-transform duration-300">
                  <span className="animate-bounce">{icon}</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full font-black text-base py-3.5 shadow-xl shadow-amber-500/25 bg-gradient-to-r from-amber-500 to-yellow-400 hover:opacity-95 text-slate-950 uppercase tracking-wider"
                onClick={() => setIsOpened(true)}
              >
                ✨ BẤM ĐỂ MỞ HỘP QUÀ NGAY! ✨
              </Button>
            </div>
          ) : (
            renderOpenedView()
          )}
        </Card>
      </div>
    </div>,
    document.body
  );

  function renderOpenedView() {
    if (!result) return null;
    return (
      <div className="relative z-10 py-2 space-y-6 animate-in zoom-in-95 duration-300">
        <div>
          <span className="text-4xl animate-bounce inline-block mb-1">🎉</span>
          <h2 className="text-2xl sm:text-3xl font-black text-amber-400">
            Khui Quà Thành Công!
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Vật phẩm đã được chuyển trực tiếp vào tài khoản của bạn:
          </p>
        </div>

        <div className="space-y-4">
          {result.ticketsAwarded > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 shadow-inner">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl bg-sky-500/20 text-2xl">
                  🎫
                </span>
                <div className="text-left">
                  <span className="block text-xs font-semibold text-sky-400 uppercase tracking-wider">
                    Vé Vòng Quay
                  </span>
                  <strong className="text-base text-[var(--navy)]">
                    +{result.ticketsAwarded} Vé Quay Gacha
                  </strong>
                </div>
              </div>
              <Link
                href="/gacha"
                className="rounded-xl bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-colors"
              >
                Quay Gacha ➔
              </Link>
            </div>
          )}

          {result.awardedCards && result.awardedCards.length > 0 && (
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[var(--muted)] text-left uppercase tracking-wider">
                Thẻ bài nhận được:
              </span>
              <div className="grid gap-3">
                {result.awardedCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-[var(--paper)] to-[var(--background)] p-3.5 text-left shadow-lg"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--background)]">
                      {card.imageUrl ? (
                        <Image
                          src={card.imageUrl}
                          alt={card.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-3xl">
                          {card.icon || "🎴"}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={RARITY_BADGES[card.rarity] || "default"} size="sm">
                          {card.rarity}
                        </Badge>
                        {card.element && (
                          <span className="text-[10px] font-semibold text-[var(--muted)]">
                            Hệ {card.element}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[var(--navy)] truncate">
                        {card.name}
                      </h4>
                      {card.attack !== undefined && card.defense !== undefined && (
                        <p className="mt-0.5 font-mono text-xs text-[var(--teal)] font-semibold">
                          ATK {card.attack} / DEF {card.defense}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)]/50 pt-4 flex flex-col sm:flex-row gap-2.5">
          <Button
            variant="secondary"
            className="w-full text-xs font-semibold"
            onClick={() => {
              onClose();
              onGoToInventory();
            }}
          >
            🎴 Xem Trong Kho Thẻ
          </Button>
          {result.ticketsAwarded > 0 ? (
            <Button
              variant="primary"
              href="/gacha"
              className="w-full text-xs font-bold shadow-md"
            >
              🎰 Đi Đến Vòng Quay Gacha
            </Button>
          ) : (
            <Button
              variant="primary"
              className="w-full text-xs font-bold shadow-md"
              onClick={onClose}
            >
              Hoàn Tất
            </Button>
          )}
        </div>
      </div>
    );
  }
}
