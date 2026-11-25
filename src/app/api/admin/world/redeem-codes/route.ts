import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  createWorldRedeemCode,
  isWorldRedeemError,
  listWorldRedeemCodes,
} from "@/lib/world-redeem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().trim().max(64).optional().nullable(),
  campaign: z.string().trim().min(1).max(80),
  rewardWood: z.number().int().min(0).max(1_000_000).default(0),
  rewardStone: z.number().int().min(0).max(1_000_000).default(0),
  rewardFood: z.number().int().min(0).max(1_000_000).default(0),
  rewardIron: z.number().int().min(0).max(1_000_000).default(0),
  rewardA2Coin: z.number().int().min(0).max(1_000_000).default(0),
  maxUses: z.number().int().min(0).max(1_000_000).default(0),
  perUserLimit: z.number().int().min(1).max(100).default(1),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }
  const codes = await listWorldRedeemCodes();
  return NextResponse.json(
    codes.map((code) => ({
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
    })),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Thông tin mã quà tặng không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const result = await createWorldRedeemCode(user.id, parsed.data);
    return NextResponse.json(
      {
        success: true,
        // Shown exactly once to the admin who created it.
        code: result.code,
        record: {
          id: result.record.id,
          codePreview: result.record.codePreview,
          campaign: result.record.campaign,
          maxUses: result.record.maxUses,
          perUserLimit: result.record.perUserLimit,
          expiresAt: result.record.expiresAt?.toISOString() ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isWorldRedeemError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
