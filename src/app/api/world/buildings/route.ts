import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  performWorldBuildingAction,
} from "@/lib/world";
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
    return NextResponse.json(await performWorldBuildingAction(user.id, parsed.data));
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
