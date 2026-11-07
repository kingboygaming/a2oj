-- CreateTable CardMarketListing
CREATE TABLE "CardMarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "pricePoints" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyerId" TEXT,

    CONSTRAINT "CardMarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable CardTradeOffer
CREATE TABLE "CardTradeOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "offeredCardId" TEXT NOT NULL,
    "offeredPoints" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable PointTransaction
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardMarketListing_status_createdAt_idx" ON "CardMarketListing"("status", "createdAt");
CREATE INDEX "CardMarketListing_sellerId_idx" ON "CardMarketListing"("sellerId");
CREATE INDEX "CardMarketListing_cardId_idx" ON "CardMarketListing"("cardId");

-- CreateIndex
CREATE INDEX "CardTradeOffer_listingId_status_idx" ON "CardTradeOffer"("listingId", "status");
CREATE INDEX "CardTradeOffer_proposerId_idx" ON "CardTradeOffer"("proposerId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_createdAt_idx" ON "PointTransaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardMarketListing" ADD CONSTRAINT "CardMarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardMarketListing" ADD CONSTRAINT "CardMarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CardMarketListing" ADD CONSTRAINT "CardMarketListing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTradeOffer" ADD CONSTRAINT "CardTradeOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "CardMarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardTradeOffer" ADD CONSTRAINT "CardTradeOffer_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardTradeOffer" ADD CONSTRAINT "CardTradeOffer_offeredCardId_fkey" FOREIGN KEY ("offeredCardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
