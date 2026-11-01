import { VerdictBadge } from "@/components/VerdictBadge";
import { hideHeuristicTestScores, parseJudgeResults } from "@/lib/submission-results";
import type { Verdict } from "@prisma/client";

const FAILURE_VERDICTS = new Set<Verdict>(["WA", "TLE", "RTE", "MLE"]);

export function SubmissionTestResults({
  log,
  currentTestCount,
}: {
  log: string;
  currentTestCount: number;
}) {
  const data = parseJudgeResults(log);
  if (!data) {
    return (
      <section className="mt-6" aria-label="Kết quả từng test">
        <h2 className="text-lg font-semibold text-[var(--navy)]">
          Kết quả từng test
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Đề hiện tại có {currentTestCount} test được dùng để chấm.
        </p>
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
          Bài nộp này được chấm trước khi hệ thống lưu trạng thái riêng cho từng
          test, nên không thể khôi phục kết quả chi tiết.
        </p>
        {log && (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
            {hideHeuristicTestScores(log)}
          </pre>
        )}
      </section>
    );
  }

  const passedCount = data.results.filter((result) => result.verdict === "AC").length;
  const failedCount = data.results.filter((result) =>
    FAILURE_VERDICTS.has(result.verdict),
  ).length;
  const notRunCount = Math.max(0, data.totalTests - data.results.length);
  const resultsByTest = new Map(data.results.map((result) => [result.test, result]));

  return (
    <section className="mt-6" aria-label="Kết quả từng test">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">
            Kết quả từng test
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {passedCount}/{data.totalTests} đúng
            {failedCount > 0 && ` · ${failedCount} lỗi`}
            {notRunCount > 0 && ` · ${notRunCount} chưa chạy`}
          </p>
        </div>
        <span className="text-xs text-[var(--muted)]">
          Mỗi dòng hiển thị trạng thái và thời gian chạy của test.
        </span>
      </div>

      {data.totalTests === 0 ? (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">
          Không có test nào được dùng để chấm bài nộp này.
        </p>
      ) : (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: data.totalTests }, (_, index) => {
            const testNumber = index + 1;
            const result = resultsByTest.get(testNumber);
            const rowStyle = result
              ? result.verdict === "AC"
                ? "border-emerald-200 bg-emerald-50"
                : result.verdict === "CE"
                  ? "border-amber-200 bg-amber-50"
                  : "border-rose-200 bg-rose-50"
              : "border-[var(--line)] bg-[var(--paper)]";

            return (
              <li
                key={testNumber}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${rowStyle}`}
              >
                <span className="text-sm font-medium text-[var(--navy)]">
                  Test {testNumber}
                </span>
                <span className="flex items-center gap-2">
                  {result ? (
                    <>
                      <VerdictBadge verdict={result.verdict} />
                      <span className="min-w-12 text-right font-mono text-xs text-[var(--muted)]">
                        {result.timeMs} ms
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">Chưa chạy</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {data.message && data.message !== "Accepted" && (
        <details className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--navy)]">
            Thông báo từ judge
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
            {data.message}
          </pre>
        </details>
      )}
    </section>
  );
}
