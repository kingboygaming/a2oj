"use client";

import { Card } from "@/components/Card";
import { MarketListingView } from "./types";
import { ListingCard } from "./ListingCard";

export function MarketTab({
  listings,
  searchQuery,
  onSearchChange,
  selectedRarity,
  onRarityChange,
  currentUserId,
  onBuyNow,
  onTradeOffer,
  onCancelListing,
}: {
  listings: MarketListingView[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedRarity: string;
  onRarityChange: (r: string) => void;
  currentUserId: string | null;
  onBuyNow: (listing: MarketListingView) => void;
  onTradeOffer: (listing: MarketListingView) => void;
  onCancelListing: (id: string) => void;
}) {
  const filteredListings = listings.filter((item) => {
    const matchSearch =
      !searchQuery ||
      item.card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.seller.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRarity = selectedRarity === "ALL" || item.card.rarity === selectedRarity;
    return matchSearch && matchRarity;
  });

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
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-[var(--navy)] placeholder-[var(--muted)] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRarityChange(r)}
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
          <p className="mt-1 text-xs text-[var(--muted)]">
            Hãy mở kho thẻ của bạn và nhấn &quot;Đăng bán&quot; để niêm yết lên chợ!
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              currentUserId={currentUserId}
              onBuyNow={onBuyNow}
              onTradeOffer={onTradeOffer}
              onCancelListing={onCancelListing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
