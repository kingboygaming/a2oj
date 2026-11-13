import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldAllianceActionError,
  isWorldAllianceUniqueConstraintError,
  loadWorldAllianceSnapshot,
  performWorldAllianceAction,
} from "@/lib/world-alliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().trim().min(3).max(32),
    tag: z.string().trim().regex(/^[A-Za-z0-9]{2,5}$/),
    description: z.string().trim().max(240),
  }),
  z.object({ action: z.literal("join"), allianceId: z.string().min(1) }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("kick"), targetUserId: z.string().min(1) }),
  z.object({ action: z.literal("transfer"), targetUserId: z.string().min(1) }),
  z.object({ action: z.literal("challenge"), defenderAllianceId: z.string().min(1) }),
  z.object({
    action: z.literal("attackWar"),
    warId: z.string().min(1),
    infantry: z.number().int().min(0).max(500),
    archers: z.number().int().min(0).max(500),
    cavalry: z.number().int().min(0).max(500),
  }),
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để xem liên minh." }, { status: 401 });

  return NextResponse.json(await loadWorldAllianceSnapshot(user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để quản lý liên minh." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Thao tác liên minh không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await performWorldAllianceAction(user.id, parsed.data));
  } catch (error) {
    if (isWorldAllianceActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isWorldAllianceUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Tag đã được dùng hoặc tài khoản vừa gia nhập liên minh khác." },
        { status: 409 },
      );
    }
    throw error;
  }
}
