-- AlterTable User add a2Coins
ALTER TABLE "User" ADD COLUMN "a2Coins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable CardMarketListing add priceCoins
ALTER TABLE "CardMarketListing" ADD COLUMN "priceCoins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable CardTradeOffer add offeredCoins
ALTER TABLE "CardTradeOffer" ADD COLUMN "offeredCoins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable PointTransaction add currency
ALTER TABLE "PointTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'A2_COIN';
