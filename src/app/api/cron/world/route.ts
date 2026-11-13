import { NextResponse } from "next/server";
import { processScheduledWorldJobs } from "@/lib/world";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET chưa được cấu hình." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Không được phép." }, { status: 401 });
  }

  const result = await processScheduledWorldJobs();
  return NextResponse.json({ ok: result.failed === 0, ...result });
}
