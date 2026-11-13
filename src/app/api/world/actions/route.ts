import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  isWorldActionError,
  isWorldUniqueConstraintError,
  performWorldAction,
} from "@/lib/world";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), eventId: z.string().min(1) }),
  z.object({ type: z.literal("contribute"), eventId: z.string().min(1) }),
  z.object({ type: z.literal("claim"), eventId: z.string().min(1) }),
  z.object({
    type: z.literal("upgrade"),
    building: z.enum(["FACTORY", "WAREHOUSE"]),
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
    return NextResponse.json(await performWorldAction(user.id, parsed.data));
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
