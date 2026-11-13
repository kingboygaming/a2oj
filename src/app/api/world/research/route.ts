import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  startWorldResearch,
} from "@/lib/world";
import { WORLD_RESEARCH_KEYS } from "@/lib/world-research";

export const runtime = "nodejs";

const requestSchema = z.object({
  researchKey: z.enum(WORLD_RESEARCH_KEYS),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để nghiên cứu." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nhánh nghiên cứu không hợp lệ." }, { status: 400 });
  }

  try {
    return NextResponse.json(await startWorldResearch(user.id, parsed.data.researchKey));
  } catch (error) {
    if (isWorldActionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isWorldUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Nghiên cứu vừa được ghi nhận. Hãy tải lại thế giới." }, { status: 409 });
    }
    throw error;
  }
}
