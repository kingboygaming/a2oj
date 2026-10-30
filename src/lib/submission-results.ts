import type { Verdict } from "@prisma/client";
import type { JudgeResult } from "@/lib/judge";

const TEST_VERDICTS = new Set<Verdict>([
  "AC",
  "WA",
  "TLE",
  "RTE",
  "CE",
  "MLE",
  "QUEUED",
  "RUNNING",
]);

export type StoredTestResults = {
  totalTests: number;
  results: JudgeResult["testResults"];
  message: string;
};

export function serializeJudgeResults(
  result: JudgeResult,
  totalTests: number,
) {
  return JSON.stringify({
    version: 1,
    totalTests,
    results: result.testResults,
    message: result.log,
  });
}

export function parseJudgeResults(log: string): StoredTestResults | null {
  try {
    const data: unknown = JSON.parse(log);
    if (!data || typeof data !== "object") return null;

    const record = data as Record<string, unknown>;
    if (
      record.version !== 1 ||
      typeof record.totalTests !== "number" ||
      !Number.isSafeInteger(record.totalTests) ||
      record.totalTests < 0 ||
      typeof record.message !== "string" ||
      !Array.isArray(record.results)
    ) {
      return null;
    }

    const results: JudgeResult["testResults"] = [];
    for (const item of record.results) {
      if (!item || typeof item !== "object") return null;
      const testResult = item as Record<string, unknown>;
      if (
        typeof testResult.test !== "number" ||
        !Number.isSafeInteger(testResult.test) ||
        testResult.test < 1 ||
        testResult.test > record.totalTests ||
        typeof testResult.timeMs !== "number" ||
        !Number.isFinite(testResult.timeMs) ||
        testResult.timeMs < 0 ||
        typeof testResult.verdict !== "string" ||
        !TEST_VERDICTS.has(testResult.verdict as Verdict)
      ) {
        return null;
      }

      results.push({
        test: testResult.test,
        verdict: testResult.verdict as Verdict,
        timeMs: testResult.timeMs,
      });
    }

    return { totalTests: record.totalTests, results, message: record.message };
  } catch {
    return null;
  }
}
