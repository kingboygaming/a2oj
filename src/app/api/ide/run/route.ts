import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runCodeInDocker, runCodeOnSamples } from "@/lib/ide-runner";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  problemId: z.string().min(1),
  language: z.enum(["CPP", "PYTHON"]),
  source: z.string().min(1).max(64_000),
  input: z.string().max(16_000),
  allSamples: z.boolean().optional(),
});

const RUNS_PER_MINUTE = 5;
const MAX_SAMPLE_RUNS = 20;
const runTimestamps = new Map<string, number[]>();

export async function POST(request: Request) {
  if (process.env.ENABLE_IDE_DOCKER_RUN !== "true") {
    return NextResponse.json(
      {
        error: "Chạy thử chưa được bật. Hãy cấu hình runner Docker trên máy chủ.",
      },
      { status: 503 },
    );
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  let originHost: string;
  try {
    originHost = origin ? new URL(origin).host.toLowerCase() : "";
  } catch {
    originHost = "";
  }
  if (!originHost || !host || originHost !== host.toLowerCase()) {
    return NextResponse.json(
      { error: "Yêu cầu chạy thử phải đến từ cùng địa chỉ A2OJ." },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Cần đăng nhập để chạy thử." }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu chạy thử không hợp lệ." }, { status: 400 });
  }

  const problem = await prisma.problem.findUnique({
    where: { id: parsed.data.problemId },
    select: {
      published: true,
      authorId: true,
      timeLimitMs: true,
      testCases: parsed.data.allSamples
        ? {
            where: { isSample: true },
            orderBy: { order: "asc" },
            select: { id: true, input: true, output: true },
          }
        : false,
    },
  });
  const staff = user.role === "TEACHER" || user.role === "ADMIN";
  if (
    !problem ||
    (!problem.published && !staff && user.id !== problem.authorId)
  ) {
    return NextResponse.json({ error: "Không tìm thấy bài tập." }, { status: 404 });
  }
  if (parsed.data.allSamples && problem.testCases.length === 0) {
    return NextResponse.json({ error: "Bài tập chưa có sample để chạy." }, { status: 400 });
  }
  if (parsed.data.allSamples && problem.testCases.length > MAX_SAMPLE_RUNS) {
    return NextResponse.json(
      { error: `Live IDE hỗ trợ chạy tối đa ${MAX_SAMPLE_RUNS} sample mỗi lần.` },
      { status: 400 },
    );
  }

  const now = Date.now();
  const recentRuns = (runTimestamps.get(user.id) ?? []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  if (recentRuns.length >= RUNS_PER_MINUTE) {
    return NextResponse.json(
      { error: "Bạn đã chạy thử quá nhiều lần. Vui lòng đợi một phút." },
      { status: 429 },
    );
  }
  recentRuns.push(now);
  runTimestamps.set(user.id, recentRuns);

  try {
    if (parsed.data.allSamples) {
      const results = await runCodeOnSamples(
        parsed.data.language,
        parsed.data.source,
        problem.testCases,
        Math.min(problem.timeLimitMs + 200, 3_000),
      );
      return NextResponse.json(results);
    }

    const result = await runCodeInDocker(
      parsed.data.language,
      parsed.data.source,
      parsed.data.input,
      Math.min(problem.timeLimitMs + 200, 3_000),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Local IDE run failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể chạy chương trình do lỗi Docker không xác định.",
      },
      { status: 500 },
    );
  }
}
