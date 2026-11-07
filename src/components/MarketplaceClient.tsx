"use client";

import { useState } from "react";
import { MarketListingView, OwnedCardView, TransactionView } from "./marketplace/types";
import { MarketplaceHeader } from "./marketplace/MarketplaceHeader";
import { MarketTab } from "./marketplace/MarketTab";
import { InventoryTab } from "./marketplace/InventoryTab";
import { ShopTab } from "./marketplace/ShopTab";
import { ConvertTab } from "./marketplace/ConvertTab";
import { HistoryTab } from "./marketplace/HistoryTab";
import { ListCardModal } from "./marketplace/ListCardModal";
import { TradeOfferModal } from "./marketplace/TradeOfferModal";
import { GiftUnboxModal } from "./marketplace/GiftUnboxModal";

export type { MarketListingView, OwnedCardView, TransactionView };

export function MarketplaceClient({
  initialListings,
  userPoints,
  userCoins,
  ownedCards,
  currentUserId,
  initialTransactions = [],
}: {
  initialListings: MarketListingView[];
  userPoints: number;
  userCoins: number;
  ownedCards: OwnedCardView[];
  currentUserId: string | null;
  initialTransactions?: TransactionView[];
}) {
  const [activeTab, setActiveTab] = useState<"market" | "inventory" | "shop" | "convert" | "history">("market");
  const [listings, setListings] = useState<MarketListingView[]>(initialListings);
  const [points, setPoints] = useState(userPoints);
  const [coins, setCoins] = useState(userCoins);
  const [myCards, setMyCards] = useState<OwnedCardView[]>(ownedCards);
  const [transactions, setTransactions] = useState<TransactionView[]>(initialTransactions);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarity, setSelectedRarity] = useState("ALL");
  const [inventoryRarity, setInventoryRarity] = useState("ALL");

  // Listing modal
  const [selectedCardToList, setSelectedCardToList] = useState<OwnedCardView | null>(null);
  const [listPriceCoins, setListPriceCoins] = useState(100);
  const [listNotes, setListNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trade modal
  const [tradeTargetListing, setTradeTargetListing] = useState<MarketListingView | null>(null);
  const [offeredCardId, setOfferedCardId] = useState("");
  const [offeredCoins, setOfferedCoins] = useState(0);
  const [tradeMessage, setTradeMessage] = useState("");

  // Convert state
  const [pointsToConvert, setPointsToConvert] = useState(10);
  const [isConverting, setIsConverting] = useState(false);

  // Dismantle state
  const [dismantlingCardId, setDismantlingCardId] = useState<string | null>(null);

  // Unbox modal state
  const [unboxResult, setUnboxResult] = useState<import("./marketplace/GiftUnboxModal").UnboxResult | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  }

  async function handleBuyNow(listing: MarketListingView) {
    if (!currentUserId) {
      notify("error", "Vui lòng đăng nhập để thực hiện giao dịch.");
      return;
    }
    const cost = listing.priceCoins > 0 ? listing.priceCoins : listing.pricePoints * 10;
    if (coins < cost) {
      notify("error", `Bạn không đủ A2 Coin (${coins.toLocaleString("vi-VN")}/${cost.toLocaleString("vi-VN")} A2C). Hãy đổi Điểm sang A2 Coin!`);
      return;
    }
    if (!confirm(`Xác nhận dùng ${cost.toLocaleString("vi-VN")} A2 Coin để mua thẻ "${listing.card.name}"?`)) return;

    try {
      const res = await fetch(`/api/market/${listing.id}/buy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCoins((c) => c - cost);
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
          priceCoins: Number(listPriceCoins),
          notes: listNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify("success", `Đã niêm yết "${selectedCardToList.card.name}" với giá ${listPriceCoins.toLocaleString("vi-VN")} A2 Coin!`);
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

  async function handleCancelListing(listingId: string) {
    if (!confirm("Gỡ thẻ khỏi sàn giao dịch và hoàn về kho đồ?")) return;
    try {
      const res = await fetch(`/api/market/${listingId}/buy`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListings((l) => l.filter((x) => x.id !== listingId));
      notify("success", "Đã gỡ bài đăng bán thành công!");
    } catch (err: unknown) {
      notify("error", (err as Error).message);
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
          offeredCoins: Number(offeredCoins),
          message: tradeMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify("success", "Đã gửi đề nghị đổi thẻ thành công!");
      setTradeTargetListing(null);
      setOfferedCardId("");
      setOfferedCoins(0);
      setTradeMessage("");
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi gửi đề nghị đổi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConvertPoints() {
    if (pointsToConvert < 1 || pointsToConvert > points) {
      notify("error", "Số điểm quy đổi không hợp lệ hoặc vượt quá số dư.");
      return;
    }
    setIsConverting(true);
    try {
      const res = await fetch("/api/market/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendancePoints: Number(pointsToConvert) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPoints(data.newAttendancePoints);
      setCoins(data.newA2Coins);
      notify("success", data.message);
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi quy đổi điểm.");
    } finally {
      setIsConverting(false);
    }
  }

  async function handleDismantleCard(cardId: string) {
    if (!confirm("Tách 1 thẻ này để nhận A2 Coin? (Thao tác không thể hoàn tác)")) return;
    setDismantlingCardId(cardId);
    try {
      const res = await fetch("/api/market/dismantle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, count: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCoins(data.newA2Coins);
      setMyCards((prev) =>
        prev
          .map((c) => (c.card.id === cardId ? { ...c, count: c.count - 1 } : c))
          .filter((c) => c.count > 0)
      );
      notify("success", data.message);
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi phân tách thẻ.");
    } finally {
      setDismantlingCardId(null);
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
        body: JSON.stringify({ packId, paymentMethod: "A2_COIN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.newBalanceCoins !== undefined) setCoins(data.newBalanceCoins);
      if (data.newBalanceTickets !== undefined) setPoints(data.newBalanceTickets);

      // Add newly awarded cards to local inventory view
      if (data.awardedCards && data.awardedCards.length > 0) {
        setMyCards((prev) => {
          const updated = [...prev];
          for (const newCard of data.awardedCards) {
            const idx = updated.findIndex((c) => c.card.id === newCard.id);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
            } else {
              updated.unshift({ card: newCard, count: 1 });
            }
          }
          return updated;
        });
      }

      // Trigger the interactive 3D gift unbox modal!
      setUnboxResult({
        itemName: data.itemName || "Gói Quà Gacha Shop",
        packId,
        ticketsAwarded: data.ticketsAwarded || 0,
        awardedCards: data.awardedCards || [],
      });
    } catch (err: unknown) {
      notify("error", (err as Error).message || "Lỗi mua vật phẩm.");
    }
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
      <MarketplaceHeader
        coins={coins}
        points={points}
        listingsCount={listings.length}
        inventoryCount={myCards.reduce((acc, c) => acc + c.count, 0)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenConvert={() => setActiveTab("convert")}
      />

      {/* Active Tab Content */}
      {activeTab === "market" && (
        <MarketTab
          listings={listings}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedRarity={selectedRarity}
          onRarityChange={setSelectedRarity}
          currentUserId={currentUserId}
          onBuyNow={handleBuyNow}
          onTradeOffer={setTradeTargetListing}
          onCancelListing={handleCancelListing}
        />
      )}

      {activeTab === "inventory" && (
        <InventoryTab
          myCards={myCards}
          inventoryRarity={inventoryRarity}
          onRarityChange={setInventoryRarity}
          onSelectListCard={setSelectedCardToList}
          onDismantleCard={handleDismantleCard}
          dismantlingCardId={dismantlingCardId}
        />
      )}

      {activeTab === "shop" && <ShopTab onPurchase={handleShopPurchase} />}

      {activeTab === "convert" && (
        <ConvertTab
          points={points}
          pointsToConvert={pointsToConvert}
          onPointsChange={setPointsToConvert}
          onConvert={handleConvertPoints}
          isConverting={isConverting}
        />
      )}

      {activeTab === "history" && <HistoryTab transactions={transactions} />}

      {/* Modals */}
      <ListCardModal
        selectedCardToList={selectedCardToList}
        listPriceCoins={listPriceCoins}
        onListPriceChange={setListPriceCoins}
        listNotes={listNotes}
        onListNotesChange={setListNotes}
        onClose={() => setSelectedCardToList(null)}
        onSubmit={handleListCard}
        isSubmitting={isSubmitting}
      />

      <TradeOfferModal
        tradeTargetListing={tradeTargetListing}
        myCards={myCards}
        offeredCardId={offeredCardId}
        onOfferedCardChange={setOfferedCardId}
        offeredCoins={offeredCoins}
        onOfferedCoinsChange={setOfferedCoins}
        tradeMessage={tradeMessage}
        onTradeMessageChange={setTradeMessage}
        onClose={() => setTradeTargetListing(null)}
        onSubmit={handleSendTrade}
        isSubmitting={isSubmitting}
        coins={coins}
      />
      {/* Unbox Gift Modal */}
      <GiftUnboxModal
        result={unboxResult}
        onClose={() => setUnboxResult(null)}
        onGoToInventory={() => setActiveTab("inventory")}
      />

    </div>
  );
}