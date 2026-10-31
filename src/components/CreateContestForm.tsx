"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TestCaseDraft = {
  input: string;
  output: string;
  isSample: boolean;
  points: number;
};

type ProblemDraft = {
  slug: string;
  title: string;
  statement: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  ioMode?: "STDIO" | "FILE";
  inputFile?: string;
  outputFile?: string;
  testCases: TestCaseDraft[];
};

function createProblemDraft(): ProblemDraft {
  return {
    slug: "",
    title: "",
    statement: "",
    difficulty: "EASY",
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    testCases: [
      { input: "", output: "", isSample: true, points: 0 },
      { input: "", output: "", isSample: false, points: 100 },
    ],
  };
}

export function CreateContestForm({
  problems,
}: {
  problems: { id: string; slug: string; title: string }[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const [newProblems, setNewProblems] = useState<ProblemDraft[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setProblemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateProblem(index: number, patch: Partial<ProblemDraft>) {
    setNewProblems((current) =>
      current.map((problem, i) => (i === index ? { ...problem, ...patch } : problem)),
    );
  }

  function updateTestCase(problemIndex: number, testIndex: number, patch: Partial<TestCaseDraft>) {
    setNewProblems((current) =>
      current.map((problem, i) =>
        i === problemIndex
          ? {
              ...problem,
              testCases: problem.testCases.map((testCase, j) =>
                j === testIndex ? { ...testCase, ...patch } : testCase,
              ),
            }
          : problem,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");

    try {
      const res = await fetch("/api/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          description,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          problemIds,
          newProblems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không tạo được contest.");
        return;
      }
      router.push(`/contests/${data.slug}`);
      router.refresh();
    } catch {
      setError("Không thể kết nối để tạo contest. Hãy kiểm tra dữ liệu và thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <label className="block text-sm">
        Slug contest
        <input
          required
          minLength={2}
          maxLength={64}
          pattern="[a-z0-9\\-]+"
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Tên kỳ thi
        <input
          required
          minLength={3}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Mô tả
        <textarea
          required
          minLength={3}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Bắt đầu
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Kết thúc
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </label>
      </div>

      <fieldset className="rounded-lg border border-[var(--line)] p-3">
        <legend className="px-1 text-sm font-medium">Chọn bài tập có sẵn</legend>
        {problems.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Chưa có bài tập thường đã xuất bản.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {problems.map((problem) => (
              <label key={problem.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={problemIds.includes(problem.id)}
                  onChange={() => toggle(problem.id)}
                />
                <span className="font-mono text-xs">{problem.slug}</span>
                {problem.title}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <section className="space-y-3 rounded-lg border border-[var(--line)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Tạo bài riêng cho contest</h2>
            <p className="text-xs text-[var(--muted)]">
              Các bài này không xuất hiện trong danh sách bài tập thường.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--teal)]"
            onClick={() => setNewProblems((current) => [...current, createProblemDraft()])}
          >
            + Thêm bài mới
          </button>
        </div>

        {newProblems.map((problem, problemIndex) => (
          <fieldset key={problemIndex} className="space-y-3 rounded-lg bg-[var(--paper)] p-3">
            <legend className="px-1 text-sm font-medium">
              Bài mới {String.fromCharCode(65 + problemIds.length + problemIndex)}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Slug
                <input
                  required
                  minLength={2}
                  maxLength={64}
                  pattern="[a-z0-9\\-]+"
                  className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
                  value={problem.slug}
                  onChange={(e) => updateProblem(problemIndex, { slug: e.target.value.toLowerCase() })}
                />
              </label>
              <label className="text-sm">
                Tên bài
                <input
                  required
                  minLength={2}
                  className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  value={problem.title}
                  onChange={(e) => updateProblem(problemIndex, { title: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Độ khó
                <select
                  className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  value={problem.difficulty}
                  onChange={(e) =>
                    updateProblem(problemIndex, {
                      difficulty: e.target.value as ProblemDraft["difficulty"],
                    })
                  }
                >
                  <option value="EASY">Dễ</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HARD">Khó</option>
                </select>
              </label>
              <label className="text-sm">
                Time limit (ms)
                <input
                  required
                  min={1}
                  type="number"
                  className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  value={problem.timeLimitMs}
                  onChange={(e) => updateProblem(problemIndex, { timeLimitMs: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                Memory limit (MB)
                <input
                  required
                  min={1}
                  type="number"
                  className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  value={problem.memoryLimitMb}
                  onChange={(e) => updateProblem(problemIndex, { memoryLimitMb: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="block text-sm">
              Đề bài (Markdown + KaTeX)
              <textarea
                required
                minLength={10}
                rows={7}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
                value={problem.statement}
                onChange={(e) => updateProblem(problemIndex, { statement: e.target.value })}
              />
            </label>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Test cases</h3>
                <button
                  type="button"
                  className="text-xs text-[var(--teal)]"
                  onClick={() =>
                    updateProblem(problemIndex, {
                      testCases: [
                        ...problem.testCases,
                        { input: "", output: "", isSample: false, points: 100 },
                      ],
                    })
                  }
                >
                  + Thêm test
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {problem.testCases.map((testCase, testIndex) => (
                  <div key={testIndex} className="rounded-md border border-[var(--line)] p-2">
                    <div className="mb-2 flex items-center gap-4 text-xs">
                      <span>Test {testIndex + 1}</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={testCase.isSample}
                          onChange={(e) =>
                            updateTestCase(problemIndex, testIndex, {
                              isSample: e.target.checked,
                              points: e.target.checked ? 0 : testCase.points || 100,
                            })
                          }
                        />
                        Sample
                      </label>
                      <label className="flex items-center gap-1">
                        Điểm
                        <input
                          type="number"
                          min={0}
                          className="w-16 rounded border border-[var(--line)] px-1"
                          value={testCase.points}
                          onChange={(e) =>
                            updateTestCase(problemIndex, testIndex, { points: Number(e.target.value) })
                          }
                        />
                      </label>
                      {problem.testCases.length > 1 && (
                        <button
                          type="button"
                          className="ml-auto text-rose-700"
                          onClick={() =>
                            updateProblem(problemIndex, {
                              testCases: problem.testCases.filter((_, i) => i !== testIndex),
                            })
                          }
                        >
                          Xóa test
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <textarea
                        aria-label={`Input test ${testIndex + 1}`}
                        placeholder="Input"
                        className="h-20 rounded-md border border-[var(--line)] p-2 font-mono text-xs"
                        value={testCase.input}
                        onChange={(e) =>
                          updateTestCase(problemIndex, testIndex, { input: e.target.value })
                        }
                      />
                      <textarea
                        aria-label={`Output test ${testIndex + 1}`}
                        placeholder="Output"
                        className="h-20 rounded-md border border-[var(--line)] p-2 font-mono text-xs"
                        value={testCase.output}
                        onChange={(e) =>
                          updateTestCase(problemIndex, testIndex, { output: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-rose-700 hover:underline"
              onClick={() =>
                setNewProblems((current) => current.filter((_, i) => i !== problemIndex))
              }
            >
              Xóa bài này
            </button>
          </fieldset>
        ))}
      </section>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button
        disabled={pending}
        className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Đang tạo..." : "Tạo contest"}
      </button>
    </form>
  );
}
