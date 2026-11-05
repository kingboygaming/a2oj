-- AlterTable
ALTER TABLE "User"
ADD COLUMN "chessRating" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN "chessGamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chessWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chessDraws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chessLosses" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChessMatch" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "whiteUserId" TEXT NOT NULL,
    "blackUserId" TEXT,
    "timeControlId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "moves" TEXT NOT NULL DEFAULT '[]',
    "initialTimeMs" INTEGER NOT NULL DEFAULT 300000,
    "whiteTimeMs" INTEGER NOT NULL DEFAULT 0,
    "blackTimeMs" INTEGER NOT NULL DEFAULT 0,
    "incrementSeconds" INTEGER NOT NULL DEFAULT 0,
    "clockStartedAt" TIMESTAMP(3),
    "drawOfferBy" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ChessMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChessMatch_roomId_status_createdAt_idx" ON "ChessMatch"("roomId", "status", "createdAt");
CREATE INDEX "ChessMatch_whiteUserId_createdAt_idx" ON "ChessMatch"("whiteUserId", "createdAt");
CREATE INDEX "ChessMatch_blackUserId_createdAt_idx" ON "ChessMatch"("blackUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChessMatch" ADD CONSTRAINT "ChessMatch_whiteUserId_fkey" FOREIGN KEY ("whiteUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChessMatch" ADD CONSTRAINT "ChessMatch_blackUserId_fkey" FOREIGN KEY ("blackUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
