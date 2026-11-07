export type MarketListingView = {
  id: string;
  priceCoins: number;
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

export type TransactionView = {
  id: string;
  amount: number;
  currency: string;
  type: string;
  description: string;
  createdAt: string;
};

export const RARITY_BADGES: Record<string, "default" | "success" | "info" | "warning" | "danger" | "purple"> = {
  COMMON: "default",
  UNCOMMON: "success",
  RARE: "info",
  EPIC: "purple",
  LEGENDARY: "warning",
  SPECIAL: "danger",
};
