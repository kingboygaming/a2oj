import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadWorldSnapshot } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập để vào thế giới." }, { status: 401 });

  const snapshot = await loadWorldSnapshot(user.id);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
