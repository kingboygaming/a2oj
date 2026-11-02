-- AlterTable
ALTER TABLE "Problem" ADD COLUMN "scoringMode" TEXT NOT NULL DEFAULT 'ICPC';

-- AlterTable
ALTER TABLE "Contest" ADD COLUMN "scoringMode" TEXT NOT NULL DEFAULT 'ICPC';
