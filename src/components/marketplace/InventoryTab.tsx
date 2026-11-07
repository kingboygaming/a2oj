"use client";

import Image from "next/image";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { OwnedCardView, RARITY_BADGES } from "./types";

export function InventoryTab({
  myCards,
  inventoryRarity,
  onRarityChange,
  onSelectListCard,
  onDismantleCard,
  dismantlingCardId,
}: {
  myCards: OwnedCardView[];
  inventoryRarity: string;
  onRarityChange: (r: string) => void;
  onSelectListCard: (item: OwnedCardView) => void;
  onDismantleCard: (cardId: string) => void;
  dismantlingCardId: string | null;
}) {
  const filteredInventory = myCards.filter((item) => {
    return inventoryRarity === "ALL" || item.card.rarity === inventoryRarity;
  });

  return (
    <div className="space-y-5">
      <Card variant="glass" className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-[var(--navy)]">Kho Thẻ Của Bạn</h2>
            <p className="text-xs text-[var(--muted)]">
              Quản lý thẻ bài sở hữu. Có thể niêm yết thẻ lên Market lấy A2 Coin hoặc tách thẻ trùng để nhận A2 Coin ngay lập tức!
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRarityChange(r)}
                className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
                  inventoryRarity === r
                    ? "bg-[var(--teal)] text-white"
                    : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--paper)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filteredInventory.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <span className="text-4xl opacity-30">🎴</span>
          <p className="mt-3 text-base font-semibold text-[var(--navy)]">Chưa có thẻ bài trong kho</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Hãy ghé thăm Gacha để thử vận may hoặc mua gói từ Cửa Hàng!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredInventory.map(({ card, count }) => (
            <Card
              key={card.id}
              hover
              variant="glass"
              className="flex flex-col justify-between overflow-hidden p-4 group"
            >
              <div>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--background)] mb-3">
                  {card.imageUrl ? (
                    <Image
                      src={card.imageUrl}
                      alt={card.name}
                      fill
                      unoptimized
                      className="object-cover transition-transform group-hover:scale-105 duration-300"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center p-4 text-center">
                      <span className="text-5xl">{card.icon}</span>
                      <span className="mt-2 text-xs font-bold text-[var(--navy)]">{card.name}</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge variant={RARITY_BADGES[card.rarity] || "default"} size="sm">
                      {card.rarity}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2 rounded-full bg-slate-900/85 px-2 py-0.5 text-xs font-bold text-amber-400 backdrop-blur-sm border border-amber-500/30">
                    x{count}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 mb-1">
                  <h3 className="font-bold text-sm text-[var(--navy)] truncate">{card.name}</h3>
                  <span className="text-[11px] font-mono text-[var(--teal)] shrink-0">
                    ATK {card.attack}
                  </span>
                </div>

                <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3">
                  {card.description || "Thẻ bài chiến thuật A2OJ."}
                </p>
              </div>

              <div className="border-t border-[var(--line)]/50 pt-3 space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full text-xs font-bold"
                  onClick={() => onSelectListCard({ card, count })}
                >
                  🏪 Đăng Bán Lên Chợ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={dismantlingCardId === card.id}
                  className="w-full text-xs text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => onDismantleCard(card.id)}
                >
                  {dismantlingCardId === card.id ? "Đang tách..." : "🔨 Tách lấy A2 Coin"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
