import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteWorldRedeemCode,
  isWorldRedeemError,
  updateWorldRedeemCode,
} from "@/lib/world-redeem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  maxUses: z.number().int().min(0).max(1_000_000).optional(),
  perUserLimit: z.number().int().min(1).max(100).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin cập nhật không hợp lệ." }, { status: 400 });
  }

  try {
    const record = await updateWorldRedeemCode(user.id, id, parsed.data);
    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        codePreview: record.codePreview,
        enabled: record.enabled,
        maxUses: record.maxUses,
        perUserLimit: record.perUserLimit,
        usedCount: record.usedCount,
        expiresAt: record.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (isWorldRedeemError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền quản trị." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await deleteWorldRedeemCode(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isWorldRedeemError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
