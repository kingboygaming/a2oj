import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeJudgeResults } from "@/lib/submission-results";

export const runtime = "nodejs";

const callbackSchema = z.object({ sourceBody: z.string().optional() });

async function handle(request: Request) {
  const callback = callbackSchema.safeParse(await request.json().catch(() => null));
  if (!callback.success || !callback.data.sourceBody) {
    return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(callback.data.sourceBody, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid source body" }, { status: 400 });
  }
  const parsed = z.object({ submissionId: z.string().min(1) }).safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });

  const result = {
    verdict: "RTE" as const,
    score: 0,
    timeMs: 0,
    log: "Hệ thống hàng đợi tạm thời không thể chấm bài. Vui lòng nộp lại.",
    testResults: [],
  };
  await prisma.submission.updateMany({
    where: { id: parsed.data.submissionId, verdict: { in: ["QUEUED", "RUNNING"] } },
    data: {
      verdict: result.verdict,
      score: result.score,
      timeMs: result.timeMs,
      log: serializeJudgeResults(result, 0),
      judgeStartedAt: null,
      judgeNextAttemptAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handle, {
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});
