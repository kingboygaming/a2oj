"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";

export type MarketListingView = {
  id: string;
  pricePoints: number;
  notes: string | null;
  createdAt: string;
  seller: { id: string; username: string; displayName: string };
  card: {
    id: string;
    name: string;
    description: string;
    rarity: string;
    battleType: string;
    attack: number;
    defense: number;
    element: string;
    icon: string;
    imageUrl: string | null;
  };
  _count: { tradeOffers: number };
};

export type OwnedCardView = {
  card: {
    id: string;
    name: string;
    description: string;
    rarity: string;
    battleType: string;
    attack: number;
    defense: number;
    element: string;
    icon: string;
    imageUrl: string | null;
  };
  count: number;
};

export const RARITY_BADGES: Record<string, "default" | "success" | "info" | "warning" | "danger" | "purple"> = {
  COMMON: "default",
  UNCOMMON: "success",
  RARE: "info",
  EPIC: "purple",
  LEGENDARY: "warning",
  SPECIAL: "danger",
};

export function MarketplaceClient({
  initialListings,
  userBalance,
  ownedCards,
  currentUserId,
}: {
  initialListings: MarketListingView[];
  userBalance: number;
  ownedCards: OwnedCardView[];
  currentUserId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"market" | "inventory" | "shop">("market");
  const [listings, setListings] = useState<MarketListingView[]>(initialListings);
  const [balance, setBalance] = useState(userBalance);
  const [myCards, setMyCards] = useState<OwnedCardView[]>(ownedCards);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState("ALL");
  const [inventoryRarity, setInventoryRarity] = useState("ALL");

  const [selectedCardToList, setSelectedCardToList] = useState<OwnedCardView | null>(null);
  const [listPrice, setListPrice] = useState(50);
  const [listNotes, setListNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tradeTargetListing, setTradeTargetListing] = useState<MarketListingView | null>(null);
  const [offeredCardId, setOfferedCardId] = useState("");
  const [offeredPoints, setOfferedPoints] = useState(0);
  const [tradeMessage, setTradeMessage] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  }

  const filteredListings = listings.filter((item) => {
    const matchSearch =
      !searchQuery ||
      item.card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRarity = selectedRarity === "ALL" || item.card.rarity === selectedRarity;
    return matchSearch && matchRarity;
  });

  const filteredInventory = myCards.filter((item) => {
    return inventoryRarity === "ALL" || item.card.rarity === inventoryRarity;
  });

  async function handleBuyNow(listing: MarketListingView) {
    if (!currentUserId) {
      notify("error", "Vui lòng đăng nhập để thực hiện giao dịch.");
      return;
    }
    if (balance < listing.pricePoints) {
      notify("error", `Bạn không đủ điểm (${balance}/${listing.pricePoints}).`);
      return;
    }
    if (!confirm(`Xác nhận dùng ${listing.pricePoints} điểm để mua thẻ "${listing.card.name}"?`)) return;

    try {
      const res = await fetch(`/api/market/${listing.id}/buy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBalance((b) => b - listing.pricePoints);
      setListings((l) => l.filter((x) => x.id !== listing.id));
      notify("success", data.message || "Giao dịch thành công!");
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Không thể hoàn tất giao dịch.");
    }
  }

  async function handleListCard() {
    if (!selectedCardToList) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCardToList.card.id,
          pricePoints: Number(listPrice),
          notes: listNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify("success", `Đã niêm yết "${selectedCardToList.card.name}" với giá ${listPrice} điểm!`);
      setSelectedCardToList(null);
      setListNotes("");
      setMyCards((prev) =>
        prev
          .map((c) => (c.card.id === selectedCardToList.card.id ? { ...c, count: c.count - 1 } : c))
          .filter((c) => c.count > 0)
      );
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi đăng bán thẻ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendTrade() {
    if (!tradeTargetListing || !offeredCardId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/market/${tradeTargetListing.id}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offeredCardId,
          offeredPoints: Number(offeredPoints),
          message: tradeMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify("success", "Đã gửi đề nghị đổi thẻ thành công!");
      setTradeTargetListing(null);
      setOfferedCardId("");
      setOfferedPoints(0);
      setTradeMessage("");
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi gửi đề nghị đổi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleShopPurchase(packId: string) {
    if (!currentUserId) {
      notify("error", "Vui lòng đăng nhập để mua sắm.");
      return;
    }
    try {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBalance(data.newBalance);
      notify("success", data.message);
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi mua vật phẩm.");
    }
  }

  function renderMarketTab() {
    return (
      <div className="space-y-5">
        <Card variant="glass" className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 min-w-[240px] items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Tìm theo tên thẻ hoặc người bán..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[var(--navy)] placeholder-[var(--muted)] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRarity(r)}
                  className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
                    selectedRarity === r
                      ? "bg-[var(--teal)] text-white"
                      : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--paper)]"
                  }`}
                >
                  {r === "ALL" ? "Tất cả" : r}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {filteredListings.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <span className="text-4xl opacity-30">📭</span>
            <p className="mt-3 text-base font-semibold text-[var(--navy)]">
              Chưa có thẻ nào được rao bán phù hợp
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredListings.map((listing) => renderListingCard(listing))}
          </div>
        )}
      </div>
    );
  }

  function renderListingCard(listing: MarketListingView) {
    return (
      <Card
        key={listing.id}
        hover
        variant="glass"
        className="flex flex-col justify-between overflow-hidden p-4 group"
      >
        <div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--background)] mb-3">
            {listing.card.imageUrl ? (
              <Image
                src={listing.card.imageUrl}
                alt={listing.card.name}
                fill
                unoptimized
                className="object-cover transition-transform group-hover:scale-105 duration-300"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center p-4 text-center">
                <span className="text-5xl">{listing.card.icon}</span>
                <span className="mt-2 text-xs font-bold text-[var(--navy)]">{listing.card.name}</span>
              </div>
            )}
            <div className="absolute top-2 left-2">
              <Badge variant={RARITY_BADGES[listing.card.rarity] || "default"} size="sm">
                {listing.card.rarity}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 mb-1">
            <h3 className="font-bold text-sm text-[var(--navy)] truncate">{listing.card.name}</h3>
            <span className="text-[11px] font-mono text-[var(--teal)] shrink-0">
              ATK {listing.card.attack}
            </span>
          </div>

          <p className="text-[11px] text-[var(--muted)] line-clamp-1 mb-3">
            Bán bởi: <strong className="text-[var(--navy)]">@{listing.seller.username}</strong>
          </p>
        </div>

        <div className="border-t border-[var(--line)]/50 pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--muted)]">Giá bán</span>
            <div className="flex items-center gap-1 text-amber-500 font-extrabold text-base">
              <span>🪙</span>
              <span>{listing.pricePoints.toLocaleString("vi-VN")}</span>
            </div>
          </div>

          {currentUserId === listing.seller.id ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-rose-400 hover:bg-rose-500/10"
              onClick={async () => {
                if (!confirm("Gỡ thẻ khỏi sàn giao dịch và hoàn về kho?")) return;
                try {
                  const res = await fetch(`/api/market/${listing.id}/buy`, { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setListings((l) => l.filter((x) => x.id !== listing.id));
                  notify("success", "Đã gỡ bài đăng bán!");
                } catch (err: unknown) {
                  notify("error", (err as Error).message);
                }
              }}
            >
              Huỷ niêm yết
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={() => setTradeTargetListing(listing)}
              >
                Đổi thẻ
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="text-xs font-bold"
                onClick={() => handleBuyNow(listing)}
              >
                Mua ngay
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  function renderShopTab() {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5">
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            <span>🎁</span> Cửa Hàng Đổi Thưởng Điểm Chuyên Cần
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Tích luỹ điểm số bằng cách giải bài tập AC và tham gia các Contest để đổi lấy các gói quay hoặc thẻ tướng độc quyền.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-sky-500/40">
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
                🎫
              </div>
              <Badge variant="info" size="sm" className="mb-2">Gói Cơ Bản</Badge>
              <h3 className="font-bold text-base text-[var(--navy)]">1 Vé Quay Gacha</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Quy đổi trực tiếp điểm chuyên cần sang lượt quay bất kỳ tại banner đang mở.
              </p>
            </div>
            <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--muted)]">Chi phí</span>
                <span className="text-amber-500 font-bold text-lg">🪙 15 điểm</span>
              </div>
              <Button
                variant="primary"
                className="w-full text-xs font-bold"
                onClick={() => handleShopPurchase("single_ticket")}
              >
                Đổi ngay
              </Button>
            </div>
          </Card>

          <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-emerald-500/40">
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
                🎒
              </div>
              <Badge variant="success" size="sm" className="mb-2">Gói Ưu Đãi</Badge>
              <h3 className="font-bold text-base text-[var(--navy)]">Túi Tân Thủ (10 Vé)</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Bao gồm 10 vé quay gacha + Tặng kèm 1 thẻ hiếm (Rare) ngẫu nhiên vào bộ sưu tập.
              </p>
            </div>
            <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--muted)]">Chi phí</span>
                <span className="text-amber-500 font-bold text-lg">🪙 120 điểm</span>
              </div>
              <Button
                variant="primary"
                className="w-full text-xs font-bold"
                onClick={() => handleShopPurchase("starter_bundle")}
              >
                Đổi ngay
              </Button>
            </div>
          </Card>

          <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-purple-500/40">
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
                📦
              </div>
              <Badge variant="purple" size="sm" className="mb-2">Gói Master</Badge>
              <h3 className="font-bold text-base text-[var(--navy)]">Hộp Thẻ Master</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Gồm 30 vé quay + chắc chắn nhận 1 Thẻ Sử Thi (Epic) mạnh mẽ cho sàn đấu bài.
              </p>
            </div>
            <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--muted)]">Chi phí</span>
                <span className="text-amber-500 font-bold text-lg">🪙 320 điểm</span>
              </div>
              <Button
                variant="primary"
                className="w-full text-xs font-bold"
                onClick={() => handleShopPurchase("booster_box")}
              >
                Đổi ngay
              </Button>
            </div>
          </Card>

          <Card variant="glass" className="flex flex-col justify-between p-5 group hover:border-amber-500/40">
            <div>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-3xl mb-4 group-hover:scale-110 transition-transform">
                👑
              </div>
              <Badge variant="warning" size="sm" className="mb-2">Độc Quyền</Badge>
              <h3 className="font-bold text-base text-[var(--navy)]">Rương Huyền Thoại</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Chắc chắn nhận ngay 1 Thẻ Huyền Thoại (Legendary) với chỉ số cực khủng.
              </p>
            </div>
            <div className="mt-6 border-t border-[var(--line)]/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--muted)]">Chi phí</span>
                <span className="text-amber-500 font-bold text-lg">🪙 600 điểm</span>
              </div>
              <Button
                variant="primary"
                className="w-full text-xs font-bold"
                onClick={() => handleShopPurchase("exclusive_legendary")}
              >
                Đổi ngay
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderInventoryTab() {
    return (
      <div className="space-y-5">
        <Card variant="glass" className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base text-[var(--navy)]">Kho Thẻ Của Bạn</h2>
              <p className="text-xs text-[var(--muted)]">
                Quản lý thẻ bài sở hữu. Các thẻ trùng lặp có thể được niêm yết bán lấy điểm trên Marketplace.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInventoryRarity(r)}
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
              Hãy ghé thăm Gacha để thử vận may hoặc mua gói từ Cửa Hàng Điểm!
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
                    <div className="absolute top-2 right-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
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

                <div className="border-t border-[var(--line)]/50 pt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs font-bold"
                    onClick={() => setSelectedCardToList({ card, count })}
                  >
                    Đăng Bán Lên Chợ
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderListModal() {
    if (!selectedCardToList) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0">
        <Card variant="glass" className="w-full max-w-md p-6">
          <h3 className="text-lg font-bold text-[var(--navy)]">
            Đăng bán: {selectedCardToList.card.name}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Thẻ sẽ được niêm yết lên chợ công khai để các bạn khác mua bằng điểm.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                Giá bán (Điểm chuyên cần)
              </label>
              <input
                type="number"
                min="1"
                max="100000"
                value={listPrice}
                onChange={(e) => setListPrice(Number(e.target.value))}
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
                onChange={(e) => setListNotes(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)]/50 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCardToList(null)}
              disabled={isSubmitting}
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleListCard}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : "Xác nhận niêm yết"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  function renderTradeModal() {
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
                onChange={(e) => setOfferedCardId(e.target.value)}
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
                Đính kèm thêm điểm (Tuỳ chọn)
              </label>
              <input
                type="number"
                min="0"
                max={balance}
                value={offeredPoints}
                onChange={(e) => setOfferedPoints(Number(e.target.value))}
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
                onChange={(e) => setTradeMessage(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--navy)]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--line)]/50 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTradeTargetListing(null)}
              disabled={isSubmitting}
            >
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendTrade}
              disabled={!offeredCardId || isSubmitting}
            >
              {isSubmitting ? "Đang gửi..." : "Gửi Đề Nghị Đổi"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200 ${
            notification.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-200"
              : "border-rose-500/40 bg-rose-950/80 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{notification.type === "success" ? "✓" : "⚠"}</span>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--paper)] via-[var(--background)] to-[var(--paper)] p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-amber-500/10 pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden="true">🏛️</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
                Sàn giao dịch thẻ PvP & Gacha Shop
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--navy)]">
              Chợ Thẻ Bài &amp; Cửa Hàng
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)] max-w-xl">
              Dùng điểm chuyên cần (tích luỹ từ việc giải bài AC) để mua gói thẻ, trao đổi hoặc rao bán thẻ trùng lặp với các thành viên khác.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3.5 shadow-lg shadow-yellow-500/5">
            <span className="text-3xl animate-bounce">🪙</span>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
                Điểm chuyên cần của bạn
              </span>
              <strong className="text-2xl font-black text-yellow-500 tabular-nums">
                {balance.toLocaleString("vi-VN")}
              </strong>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)]/50 pt-5">
          <button
            type="button"
            onClick={() => setActiveTab("market")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "market"
                ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
                : "text-[var(--navy)] hover:bg-[var(--background)]"
            }`}
          >
            <span>🏪</span>
            <span>Chợ Thẻ Đang Rao ({listings.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shop")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "shop"
                ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
                : "text-[var(--navy)] hover:bg-[var(--background)]"
            }`}
          >
            <span>🎁</span>
            <span>Gacha Shop Điểm</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "inventory"
                ? "bg-[var(--teal)] text-white shadow-md shadow-[var(--teal)]/25"
                : "text-[var(--navy)] hover:bg-[var(--background)]"
            }`}
          >
            <span>🎴</span>
            <span>Kho Thẻ Của Bạn ({myCards.reduce((acc, c) => acc + c.count, 0)})</span>
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === "market" && renderMarketTab()}
      {activeTab === "shop" && renderShopTab()}
      {activeTab === "inventory" && renderInventoryTab()}

      {/* MODALS */}
      {renderListModal()}
      {renderTradeModal()}
    </div>
  );
}
