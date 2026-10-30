"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseTestCaseZip } from "@/lib/testcase-zip";

type Case = {
  input: string;
  output: string;
  isSample: boolean;
  points: number;
  name?: string;
};

type ProblemDraft = {
  id: string;
  slug: string;
  title: string;
  statement: string;
  difficulty: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: Case[];
};

export function ContributeForm({
  problem,
}: {
  problem?: ProblemDraft;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(problem?.slug ?? "");
  const [title, setTitle] = useState(problem?.title ?? "");
  const [statement, setStatement] = useState(
    problem?.statement ?? "Cho $n$. Tính ...\n\n## Input\n\n## Output\n",
  );
  const [difficulty, setDifficulty] = useState(problem?.difficulty ?? "EASY");
  const [timeLimitMs, setTimeLimitMs] = useState(problem?.timeLimitMs ?? 1000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(problem?.memoryLimitMb ?? 256);
  const [cases, setCases] = useState<Case[]>(
    problem?.testCases ?? [
      { input: "", output: "", isSample: true, points: 0 },
      { input: "", output: "", isSample: false, points: 100 },
    ],
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");

  function updateCase(i: number, patch: Partial<Case>) {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeCase(i: number) {
    setCases((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function importTestZip(file?: File) {
    setImportMessage("");
    setImportError("");
    if (!file) return;

    try {
      const imported = parseTestCaseZip(new Uint8Array(await file.arrayBuffer()));
      setCases((current) => [
        ...current,
        ...imported.map(({ name, ...testCase }) => ({ ...testCase, name })),
      ]);
      setImportMessage(
        `Đã thêm ${imported.length} test từ ${file.name}. Các test mới được đánh dấu là test ẩn.`,
      );
    } catch (cause) {
      setImportError(
        cause instanceof Error ? cause.message : "Không đọc được file ZIP.",
      );
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch(
        problem ? `/api/admin/problems/${problem.id}` : "/api/problems",
        {
          method: problem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            title,
            statement,
            difficulty,
            timeLimitMs,
            memoryLimitMb,
            testCases: cases,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (problem ? "Không thể cập nhật đề." : "Không tạo được đề."));
        return;
      }

      router.push(problem ? "/admin/problems" : `/problems/${data.slug}`);
      router.refresh();
    } catch {
      setError("Không thể kết nối để lưu đề. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Slug
          <input
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="tong-day"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Dùng chữ thường, số và dấu gạch nối, ví dụ: hgb001.
          </span>
        </label>
        <label className="text-sm">
          Tiêu đề
          <input
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Độ khó
          <select
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </select>
        </label>
        <label className="text-sm">
          Time limit (ms)
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={timeLimitMs}
            onChange={(e) => setTimeLimitMs(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Memory limit (MB)
          <input
            type="number"
            min={1}
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={memoryLimitMb}
            onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block text-sm">
        Đề bài (Markdown + KaTeX)
        <textarea
          required
          rows={12}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
      </label>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Test cases</h2>
          <button
            type="button"
            className="text-xs text-[var(--teal)]"
            onClick={() =>
              setCases((c) => [...c, { input: "", output: "", isSample: false, points: 100 }])
            }
          >
            + Thêm test
          </button>
        </div>
        <label className="mt-3 block rounded-lg border border-dashed border-[var(--line)] bg-[var(--paper)] p-4 text-sm">
          <span className="font-medium text-[var(--navy)]">Nhập test từ file ZIP</span>
          <input
            type="file"
            accept=".zip,application/zip"
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-strong)] file:px-3 file:py-2 file:text-white"
            onChange={(event) => {
              void importTestZip(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span className="mt-2 block text-xs text-[var(--muted)]">
            ZIP chứa các cặp cùng tên như 01.in + 01.out. Có thể đặt trong thư mục con.
            File tối đa 5 MB, mỗi test tối đa 2 MB và tối đa 100 cặp.
          </span>
        </label>
        {importMessage && (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            {importMessage}
          </p>
        )}
        {importError && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {importError}
          </p>
        )}
        <div className="mt-2 space-y-3">
          {cases.map((c, i) => (
            <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
              <div className="mb-2 flex items-center gap-4 text-xs">
                <span className="font-medium text-[var(--muted)]">
                  {c.name ?? `Test ${i + 1}`}
                </span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={c.isSample}
                    onChange={(e) => updateCase(i, { isSample: e.target.checked })}
                  />
                  Sample
                </label>
                <label>
                  Điểm
                  <input
                    type="number"
                    className="ml-1 w-16 rounded border border-[var(--line)] px-1"
                    value={c.points}
                    onChange={(e) => updateCase(i, { points: Number(e.target.value) })}
                  />
                </label>
                {cases.length > 1 && (
                  <button
                    type="button"
                    className="ml-auto text-rose-700 hover:underline"
                    onClick={() => removeCase(i)}
                  >
                    Xóa test
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <textarea
                  placeholder="Input"
                  className="h-24 rounded-md border border-[var(--line)] p-2 font-mono text-xs"
                  value={c.input}
                  onChange={(e) => updateCase(i, { input: e.target.value })}
                />
                <textarea
                  placeholder="Output"
                  className="h-24 rounded-md border border-[var(--line)] p-2 font-mono text-xs"
                  value={c.output}
                  onChange={(e) => updateCase(i, { output: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        disabled={pending}
        className="rounded-md bg-[var(--surface-strong)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang lưu..." : problem ? "Lưu thay đổi" : "Đăng đề"}
      </button>
    </form>
  );
}
