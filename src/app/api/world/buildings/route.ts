import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  performWorldBuildingAction,
} from "@/lib/world";
import { broadcastBaseChanges } from "@/lib/world-realtime-server";
import { WORLD_BUILDING_PLOT_COUNT, WORLD_BUILDING_TYPES } from "@/lib/world-buildings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UPGRADE_CASTLE") }),
  z.object({
    type: z.literal("BUILD"),
    plotIndex: z.number().int().min(0).max(WORLD_BUILDING_PLOT_COUNT - 1),
    buildingType: z.enum(WORLD_BUILDING_TYPES),
  }),
  z.object({
    type: z.enum(["UPGRADE", "DEMOLISH"]),
    plotIndex: z.number().int().min(0).max(WORLD_BUILDING_PLOT_COUNT - 1),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để xây dựng." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Thao tác xây dựng không hợp lệ." }, { status: 400 });
  }

  try {
    const result = await performWorldBuildingAction(user.id, parsed.data);
    if (parsed.data.type === "UPGRADE_CASTLE") {
      // Castle level is part of the public base projection other players render.
      after(() => broadcastBaseChanges([user.id]));
    }
    return NextResponse.json(result);
  } catch (error) {
    if (isWorldActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isWorldUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Ô đất vừa được sử dụng. Hãy tải lại thành phố." }, { status: 409 });
    }
    throw error;
  }
}
