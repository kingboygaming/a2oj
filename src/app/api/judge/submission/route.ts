import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gradeStoredSubmission } from "@/lib/submission-grading";
import { completeSubmission } from "@/lib/gacha";
import { serializeJudgeResults } from "@/lib/submission-results";

export const runtime = "nodejs";
export const maxDuration = 60;

const payloadSchema = z.object({ submissionId: z.string().min(1) });

async function handle(request: Request) {
  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { submissionId } = payload.data;
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission || !["QUEUED", "RUNNING"].includes(submission.verdict)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const staleBefore = new Date(Date.now() - 60_000);
  const claim = await prisma.submission.updateMany({
    where: {
      id: submissionId,
      OR: [
        { verdict: "QUEUED" },
        { verdict: "RUNNING", judgeStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      verdict: "RUNNING",
      judgeAttempts: { increment: 1 },
      judgeStartedAt: new Date(),
      judgeNextAttemptAt: null,
    },
  });
  if (claim.count === 0) return NextResponse.json({ ok: true, skipped: true });

  try {
    const { result, totalTests } = await gradeStoredSubmission(submissionId);
    await completeSubmission(submissionId, result, serializeJudgeResults(result, totalTests));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Queued submission grading failed:", error);
    await prisma.submission.updateMany({
      where: { id: submissionId, verdict: "RUNNING" },
      data: { verdict: "QUEUED", judgeStartedAt: null },
    });
    return NextResponse.json({ error: "Temporary judge failure" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return NextResponse.json({ error: "QStash signing keys are not configured." }, { status: 503 });
  }

  return verifySignatureAppRouter(handle, { currentSigningKey, nextSigningKey })(request);
}
