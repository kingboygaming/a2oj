CREATE TABLE "UserBattleDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserBattleDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBattleDeckCard" (
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "UserBattleDeckCard_pkey" PRIMARY KEY ("deckId", "cardId")
);

CREATE UNIQUE INDEX "UserBattleDeck_userId_key" ON "UserBattleDeck"("userId");

ALTER TABLE "UserBattleDeck" ADD CONSTRAINT "UserBattleDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBattleDeckCard" ADD CONSTRAINT "UserBattleDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "UserBattleDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBattleDeckCard" ADD CONSTRAINT "UserBattleDeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
