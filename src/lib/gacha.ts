import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JudgeResult } from "@/lib/judge";

type BannerCardOdds = { cardId: string; dropRate: number };

export const GACHA_RARITIES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "R",
  "SR",
  "SSR",
  "EPIC",
  "LEGENDARY",
  "SPECIAL",
] as const;

export function isBannerAvailable(
  banner: { active: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
) {
  return banner.active && (!banner.startsAt || banner.startsAt <= now) && (!banner.endsAt || banner.endsAt > now);
}

export function chooseBannerCard(cards: BannerCardOdds[]) {
  const rateUnits = cards.map(({ dropRate }) => Math.round(dropRate * 10_000));
  const total = rateUnits.reduce((sum, rate) => sum + rate, 0);
  if (total !== 1_000_000) throw new Error("Tỉ lệ thẻ trong banner phải có tổng bằng 100%.");
  let roll = randomInt(total);
  for (let index = 0; index < cards.length; index += 1) {
    roll -= rateUnits[index];
    if (roll < 0) return cards[index].cardId;
  }
  throw new Error("Không thể chọn thẻ từ banner.");
}

function randomBetween(min: number, max: number) {
  return randomInt(min, max + 1);
}

type RewardSource = {
  gachaAcRewardMin: number;
  gachaAcRewardMax: number;
  gachaPacRewardMin: number;
  gachaPacRewardMax: number;
  specialGachaCardId: string | null;
  specialGachaDropRate: number;
};

async function awardClaim(
  transaction: Prisma.TransactionClient,
  submission: {
    id: string;
    userId: string;
    problemId: string;
    contestId: string | null;
  },
  verdict: JudgeResult["verdict"],
  score: number,
  scoringMode: string,
  source: RewardSource,
) {
  const rewardType = verdict === "AC"
    ? "AC"
    : scoringMode === "VNOI" && score > 0
      ? "PAC"
      : null;
  if (!rewardType) return null;

  const eventKey = `${submission.userId}:${submission.problemId}:${submission.contestId ?? "practice"}:${rewardType}`;
  const existingClaim = await transaction.gachaRewardClaim.findUnique({ where: { eventKey } });
  if (existingClaim) return null;

  const minTickets = rewardType === "AC" ? source.gachaAcRewardMin : source.gachaPacRewardMin;
  const maxTickets = rewardType === "AC" ? source.gachaAcRewardMax : source.gachaPacRewardMax;
  const ticketsAwarded = randomBetween(minTickets, maxTickets);
  const droppedCardId =
    source.specialGachaCardId && randomInt(10_000) < Math.round(source.specialGachaDropRate * 100)
      ? source.specialGachaCardId
      : null;
  const claim = await transaction.gachaRewardClaim.create({
    data: {
      eventKey,
      userId: submission.userId,
      problemId: submission.problemId,
      contestId: submission.contestId,
      submissionId: submission.id,
      rewardType,
      ticketsAwarded,
      cardId: droppedCardId,
    },
    include: { card: { select: { name: true, rarity: true } } },
  });
  if (ticketsAwarded > 0) {
    await transaction.user.update({
      where: { id: submission.userId },
      data: { gachaTickets: { increment: ticketsAwarded } },
    });
  }
  if (droppedCardId) {
    await transaction.userGachaCard.upsert({
      where: { userId_cardId: { userId: submission.userId, cardId: droppedCardId } },
      create: { userId: submission.userId, cardId: droppedCardId },
      update: { count: { increment: 1 } },
    });
  }
  return claim;
}

export async function completeSubmission(
  submissionId: string,
  result: JudgeResult,
  serializedLog: string,
): Promise<{ submission: Awaited<ReturnType<typeof updateSubmission>>; reward: Awaited<ReturnType<typeof awardClaim>> }> {
  return prisma.$transaction(async (transaction) => {
    const submission = await transaction.submission.findUnique({
      where: { id: submissionId },
      select: {
        userId: true,
        id: true,
        problemId: true,
        contestId: true,
        problem: {
          select: {
            scoringMode: true,
            gachaAcRewardMin: true,
            gachaAcRewardMax: true,
            gachaPacRewardMin: true,
            gachaPacRewardMax: true,
            specialGachaCardId: true,
            specialGachaDropRate: true,
          },
        },
      },
    });
    if (!submission) throw new Error("Không tìm thấy bài nộp cần hoàn tất.");

    const updated = await updateSubmission(transaction, submissionId, result, serializedLog);
    const contest = submission.contestId
      ? await transaction.contest.findUnique({
          where: { id: submission.contestId },
          select: {
            scoringMode: true,
            gachaAcRewardMin: true,
            gachaAcRewardMax: true,
            gachaPacRewardMin: true,
            gachaPacRewardMax: true,
            specialGachaCardId: true,
            specialGachaDropRate: true,
          },
        })
      : null;
    const source = contest ?? submission.problem;
    const reward = await awardClaim(
      transaction,
      submission,
      result.verdict,
      result.score,
      contest?.scoringMode ?? submission.problem.scoringMode,
      source,
    );
    return { submission: updated, reward };
  });
}

async function updateSubmission(
  transaction: Prisma.TransactionClient,
  submissionId: string,
  result: JudgeResult,
  serializedLog: string,
) {
  return transaction.submission.update({
    where: { id: submissionId },
    data: {
      verdict: result.verdict,
      score: result.score,
      timeMs: result.timeMs,
      log: serializedLog,
      judgeStartedAt: null,
      judgeNextAttemptAt: null,
    },
    include: { problem: { select: { slug: true, title: true } } },
  });
}
