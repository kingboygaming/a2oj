"use client";

import Image from "next/image";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { MarketListingView, RARITY_BADGES } from "./types";

export function ListingCard({
  listing,
  currentUserId,
  onBuyNow,
  onTradeOffer,
  onCancelListing,
}: {
  listing: MarketListingView;
  currentUserId: string | null;
  onBuyNow: (listing: MarketListingView) => void;
  onTradeOffer: (listing: MarketListingView) => void;
  onCancelListing: (id: string) => void;
}) {
  const priceInCoins = listing.priceCoins > 0 ? listing.priceCoins : listing.pricePoints * 10;

  return (
    <Card
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
            ATK {listing.card.attack} / DEF {listing.card.defense}
          </span>
        </div>

        <p className="text-[11px] text-[var(--muted)] line-clamp-1 mb-2">
          Bán bởi: <strong className="text-[var(--navy)]">@{listing.seller.username}</strong>
        </p>

        {listing.notes && (
          <p className="text-[11px] italic text-[var(--muted)] bg-[var(--background)]/50 rounded-lg p-2 mb-3">
            &quot;{listing.notes}&quot;
          </p>
        )}
      </div>

      <div className="border-t border-[var(--line)]/50 pt-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[var(--muted)]">Giá bán</span>
          <div className="flex items-center gap-1.5 text-amber-500 font-extrabold text-base">
            <span className="size-5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] flex items-center justify-center font-black">
              A2
            </span>
            <span>{priceInCoins.toLocaleString("vi-VN")}</span>
            <span className="text-xs text-amber-500/70 font-semibold">A2C</span>
          </div>
        </div>

        {currentUserId === listing.seller.id ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-rose-400 hover:bg-rose-500/10"
            onClick={() => onCancelListing(listing.id)}
          >
            Huỷ niêm yết
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => onTradeOffer(listing)}
            >
              Đổi thẻ
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="text-xs font-bold"
              onClick={() => onBuyNow(listing)}
            >
              Mua ngay
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
