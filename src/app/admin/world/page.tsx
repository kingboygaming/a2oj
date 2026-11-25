import Link from "next/link";
import { notFound } from "next/navigation";
import { WorldEventAdmin } from "@/components/WorldEventAdmin";
import { WorldRedeemCodeAdmin } from "@/components/WorldRedeemCodeAdmin";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listWorldRedeemCodes } from "@/lib/world-redeem";

export const dynamic = "force-dynamic";

export default async function AdminWorldPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  const now = new Date();
  const [events, redeemCodes] = await Promise.all([
    prisma.worldEvent.findMany({
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        _count: { select: { participants: true } },
        jobs: { select: { status: true, attempts: true, lastError: true } },
      },
    }),
    listWorldRedeemCodes(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản trị
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">Quản trị thế giới</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Lịch sự kiện</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Tạo sự kiện thu thập tài nguyên có điều kiện tham gia, giới hạn người chơi và thưởng theo thứ hạng.
        </p>
      </header>
      <WorldEventAdmin
        initialEvents={events.map((event) => ({
          id: event.id,
          slug: event.slug,
          eventType: event.eventType === "WORLD_BOSS" ? "WORLD_BOSS" : "RESOURCE_RUSH",
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          participantLimit: event.participantLimit,
          participantCount: event.participantCount,
          registeredCount: event._count.participants,
          minFactoryLevel: event.minFactoryLevel,
          contributionWoodCost: event.contributionWoodCost,
          contributionCooldownSeconds: event.contributionCooldownSeconds,
          bossHp: event.bossHp,
          bossHpRemaining: event.bossHpRemaining,
          marchTravelSeconds: event.marchTravelSeconds,
          rewards: [
            { wood: event.firstRewardWood, stone: event.firstRewardStone },
            { wood: event.secondRewardWood, stone: event.secondRewardStone },
            { wood: event.thirdRewardWood, stone: event.thirdRewardStone },
          ],
          status:
            event.status === "CANCELED" || event.status === "COMPLETED"
              ? event.status
              : now < event.startsAt
                ? "SCHEDULED"
                : now < event.endsAt
                  ? "ACTIVE"
                  : "PROCESSING",
          job: event.jobs[0]
            ? {
                status: event.jobs[0].status,
                attempts: event.jobs[0].attempts,
                lastError: event.jobs[0].lastError,
              }
            : null,
        }))}
      />
      <WorldRedeemCodeAdmin
        initialCodes={redeemCodes.map((code) => ({
          id: code.id,
          codePreview: code.codePreview,
          campaign: code.campaign,
          rewardWood: code.rewardWood,
          rewardStone: code.rewardStone,
          rewardFood: code.rewardFood,
          rewardIron: code.rewardIron,
          rewardA2Coin: code.rewardA2Coin,
          maxUses: code.maxUses,
          perUserLimit: code.perUserLimit,
          usedCount: code.usedCount,
          redemptionCount: code._count.redemptions,
          startsAt: code.startsAt?.toISOString() ?? null,
          expiresAt: code.expiresAt?.toISOString() ?? null,
          enabled: code.enabled,
          createdAt: code.createdAt.toISOString(),
          createdByName: code.createdBy
            ? code.createdBy.displayName || code.createdBy.username
            : null,
        }))}
      />
    </div>
  );
}
