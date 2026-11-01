ALTER TABLE "Submission"
  ADD COLUMN "judgeAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "judgeNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "judgeStartedAt" TIMESTAMP(3);

CREATE INDEX "Submission_verdict_judgeNextAttemptAt_createdAt_idx"
  ON "Submission"("verdict", "judgeNextAttemptAt", "createdAt");
