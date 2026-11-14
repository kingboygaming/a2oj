import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  performWorldMapAction,
} from "@/lib/world";
import { broadcastMapObjectChange } from "@/lib/world-realtime-server";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GATHER"), targetId: z.string().min(1) }),
  z.object({
    type: z.literal("DISPATCH"),
    targetId: z.string().min(1),
    infantry: z.number().int().min(0).max(500),
    archers: z.number().int().min(0).max(500),
    cavalry: z.number().int().min(0).max(500),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để chơi." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thao tác bản đồ không hợp lệ." }, { status: 400 });
  }

  try {
    const result = await performWorldMapAction(user.id, parsed.data);
    after(() => broadcastMapObjectChange(parsed.data.targetId));
    return NextResponse.json(result);
  } catch (error) {
    if (isWorldActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isWorldUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Thao tác vừa được ghi nhận. Hãy tải lại thế giới." }, { status: 409 });
    }
    throw error;
  }
}
