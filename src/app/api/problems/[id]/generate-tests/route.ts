import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runReferenceCodeOnWandbox } from "@/lib/judge";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  language: z.enum(["CPP", "PYTHON"]),
  source: z.string().min(1).max(64_000),
  inputs: z.array(z.string().min(1).max(24_000)).min(1).max(10),
});

const RUNS_PER_MINUTE = 3;
const runTimestamps = new Map<string, number[]>();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 500_000) {
    return NextResponse.json({ error: "Yêu cầu vượt quá giới hạn kích thước." }, { status: 413 });
  }
  const [{ id }, json] = await Promise.all([
    context.params,
    request.json().catch(() => null),
  ]);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu chạy lời giải không hợp lệ." }, { status: 400 });
  }

  const problem = await prisma.problem.findUnique({
    where: { id },
    select: { id: true, authorId: true, published: true, timeLimitMs: true, ioMode: true },
  });
  if (!problem) return NextResponse.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
  if (!(user.role === "ADMIN" || (!problem.published && problem.authorId === user.id))) {
    return NextResponse.json({ error: "Bạn không có quyền tạo test cho bài này." }, { status: 403 });
  }
  if (problem.ioMode === "FILE") {
    return NextResponse.json({ error: "API chạy lời giải hiện chỉ hỗ trợ bài dùng stdin/stdout." }, { status: 400 });
  }

  const now = Date.now();
  const recent = (runTimestamps.get(user.id) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= RUNS_PER_MINUTE) {
    return NextResponse.json({ error: "Đã chạy lời giải quá nhiều lần. Hãy đợi một phút." }, { status: 429 });
  }
  recent.push(now);
  runTimestamps.set(user.id, recent);

  try {
    const outputs = await runReferenceCodeOnWandbox(
      parsed.data.language,
      parsed.data.source,
      parsed.data.inputs,
      Math.min(problem.timeLimitMs, 3_000),
    );
    if (outputs.some((output) => Buffer.byteLength(output, "utf8") > 24_000)) {
      return NextResponse.json({ error: "Output của lời giải vượt quá giới hạn 24 KB cho mỗi test." }, { status: 422 });
    }
    return NextResponse.json({ outputs });
  } catch (error) {
    console.error("Reference solution execution failed:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Không thể chạy lời giải tham chiếu.",
    }, { status: 502 });
  }
}
