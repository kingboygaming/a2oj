import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { runReferenceCodeWithFallback } from "@/lib/judge";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  language: z.enum(["CPP", "PYTHON"]),
  source: z.string().min(1).max(64_000),
  inputs: z.array(z.string().max(24_000)).min(1).max(10),
});

const RUNS_PER_MINUTE = 3;
const runTimestamps = new Map<string, number[]>();

function isLocalJudgeMode(): boolean {
  const mode = process.env.JUDGE_MODE?.toLowerCase();
  return mode === "auto";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host.toLowerCase() : "";
  } catch {
    originHost = "";
  }
  if (!originHost || !host || originHost !== host.toLowerCase()) {
    return NextResponse.json({ error: "Yêu cầu phải đến từ cùng địa chỉ A2OJ." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  }
  if (!canManageContests(user.role)) {
    return NextResponse.json({ error: "Chỉ giáo viên hoặc quản trị viên mới được chạy lời giải contest." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 500_000) {
    return NextResponse.json({ error: "Yêu cầu vượt quá giới hạn kích thước." }, { status: 413 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu chạy lời giải không hợp lệ." }, { status: 400 });
  }

  const now = Date.now();
  const recent = (runTimestamps.get(user.id) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= RUNS_PER_MINUTE) {
    return NextResponse.json({ error: "Đã chạy lời giải quá nhiều lần. Hãy đợi một phút." }, { status: 429 });
  }
  recent.push(now);
  runTimestamps.set(user.id, recent);

  try {
    const outputs = await runReferenceCodeWithFallback(
      parsed.data.language,
      parsed.data.source,
      parsed.data.inputs,
      3_000,
      isLocalJudgeMode(),
    );

    if (outputs.some((output) => Buffer.byteLength(output, "utf8") > 24_000)) {
      return NextResponse.json({ error: "Output của lời giải vượt quá giới hạn 24 KB cho mỗi test." }, { status: 422 });
    }
    return NextResponse.json({ outputs });
  } catch (error) {
    console.error("Contest reference solution execution failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Không thể chạy lời giải tham chiếu.",
    }, { status: 502 });
  }
}
