import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isWorldRedeemError, redeemWorldCode } from "@/lib/world-redeem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập để nhập mã quà tặng." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mã quà tặng không hợp lệ." }, { status: 400 });
  }

  try {
    const result = await redeemWorldCode(user.id, parsed.data.code);
    return NextResponse.json(result);
  } catch (error) {
    if (isWorldRedeemError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
