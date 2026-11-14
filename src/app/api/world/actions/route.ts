import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  performWorldAction,
} from "@/lib/world";
import { broadcastBaseChanges } from "@/lib/world-realtime-server";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), eventId: z.string().min(1) }),
  z.object({ type: z.literal("contribute"), eventId: z.string().min(1) }),
  z.object({ type: z.literal("claim"), eventId: z.string().min(1) }),
  z.object({
    type: z.literal("upgrade"),
    building: z.enum(["FACTORY", "WAREHOUSE"]),
  }),
  z.object({
    type: z.literal("train"),
    troopType: z.enum(["INFANTRY", "ARCHERS", "CAVALRY"]),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    type: z.literal("dispatch"),
    eventId: z.string().min(1),
    infantry: z.number().int().min(0).max(500),
    archers: z.number().int().min(0).max(500),
    cavalry: z.number().int().min(0).max(500),
  }),
  z.object({
    type: z.literal("attackBase"),
    targetUserId: z.string().min(1),
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
    return NextResponse.json({ error: "Thao tác thế giới không hợp lệ." }, { status: 400 });
  }

  try {
    const result = await performWorldAction(user.id, parsed.data);
    if (parsed.data.type === "attackBase") {
      // Attackers and defenders are usually in the same region, but group by
      // region inside the helper so both sides get the hint.
      const targetUserId = parsed.data.targetUserId;
      after(() => broadcastBaseChanges([user.id, targetUserId]));
    }
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
