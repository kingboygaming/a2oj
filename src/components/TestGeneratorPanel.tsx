"use client";

import { useState } from "react";
import { strToU8, zipSync } from "fflate";
import { generateTestInputs, testGeneratorSchema, type TestGenerationMode } from "@/lib/test-generator";

type GeneratedCase = { input: string; output: string; outputReady: boolean };
type ReadyCase = { input: string; output: string };
type Mode = TestGenerationMode;

const initialSpecification = JSON.stringify({
  variables: [
    { name: "n", type: "int", min: 1, max: 100 },
    { name: "a", type: "intArray", length: "n", min: -1000, max: 1000 },
  ],
  template: "{n}\n{a}\n",
}, null, 2);

export function TestGeneratorPanel({
  problemId,
  runEndpoint,
  onAddCases,
}: {
  problemId?: string;
  runEndpoint?: string;
  onAddCases: (cases: ReadyCase[]) => void;
}) {
  const [specification, setSpecification] = useState(initialSpecification);
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<"CPP" | "PYTHON">("CPP");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<Mode>("mixed");
  const [generated, setGenerated] = useState<GeneratedCase[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [runPending, setRunPending] = useState(false);

  function generate() {
    setError("");
    setMessage("");
    setGenerated([]);
    let parsedSpecification: unknown;
    try {
      parsedSpecification = JSON.parse(specification);
    } catch {
      setError("Cấu hình input phải là JSON hợp lệ.");
      return;
    }
    const parsed = testGeneratorSchema.safeParse(parsedSpecification);
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return;
    }

    try {
      setGenerated(generateTestInputs(parsed.data, count, mode).map((input) => ({ input, output: "", outputReady: false })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể sinh input.");
    }
  }

  function loadGraphExample() {
    setSpecification(JSON.stringify({
      variables: [
        { name: "n", type: "int", min: 1, max: 100 },
        { name: "a", type: "undirectedGraphMatrix", size: "n" },
      ],
      template: "{n}\n{a}\n",
    }, null, 2));
    setError("");
    setMessage("Đã nạp mẫu đồ thị vô hướng: ma trận luôn đối xứng, đường chéo chính bằng 0.");
  }

  function downloadInputs() {
    const files = Object.fromEntries(
      generated.map((testCase, index) => [
        `${String(index + 1).padStart(2, "0")}.in`,
        strToU8(testCase.input),
      ]),
    );
    const archive = zipSync(files, { level: 6 });
    const url = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "generated-inputs.zip";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateOutput(index: number, output: string) {
    setGenerated((current) => current.map((testCase, itemIndex) =>
      itemIndex === index ? { ...testCase, output, outputReady: true } : testCase,
    ));
  }

  async function runReferenceSolution() {
    setError("");
    setMessage("");
    if (!runEndpoint && !problemId) {
      setError("Hãy lưu đề trước, sau đó mở lại để chạy lời giải.");
      return;
    }
    if (!source.trim()) {
      setError("Hãy dán lời giải tham chiếu đã AC.");
      return;
    }
    if (generated.length === 0) {
      setError("Hãy sinh input trước.");
      return;
    }

    setRunPending(true);
    try {
      const endpoint = runEndpoint ?? `/api/problems/${encodeURIComponent(problemId!)}/generate-tests`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, source, inputs: generated.map((testCase) => testCase.input) }),
        signal: AbortSignal.timeout(90_000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Không thể chạy lời giải tham chiếu.");
        return;
      }
      if (!Array.isArray(result.outputs) || result.outputs.length !== generated.length || !result.outputs.every((output: unknown) => typeof output === "string")) {
        setError("Máy chủ trả về output không hợp lệ.");
        return;
      }
      setGenerated((current) => current.map((testCase, index) => ({
        ...testCase,
        output: result.outputs[index],
        outputReady: true,
      })));
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "Chạy lời giải quá thời gian chờ."
          : "Không thể kết nối tới API chấm dự phòng của website.",
      );
    } finally {
      setRunPending(false);
    }
  }

  const missingOutputs = generated.filter((testCase) => !testCase.outputReady).length;

  return (
    <section className="mt-4 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 p-4">
      <div>
        <h3 className="font-semibold text-[var(--navy)]">Sinh input test</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          Khai báo biến, miền giá trị và template input. Web sinh input ngay trên trình duyệt. Để tự tạo output, dùng API chấm cloud dự phòng của website; không cần Docker.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Khi chạy tự động, code được gửi tới dịch vụ chấm cloud (Wandbox) mà website đang dùng làm dự phòng. Dịch vụ miễn phí có thể giới hạn hoặc quá tải; bạn cũng có thể chạy code trên máy rồi dán output thủ công.
        </p>
      </div>

      <div>
          <label className="mt-3 block text-xs font-medium">
            Cấu hình sinh input (JSON)
            <textarea
              rows={12}
              value={specification}
              onChange={(event) => setSpecification(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] p-2 font-mono text-xs"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            onClick={loadGraphExample}
            className="mt-2 rounded-md border border-[var(--teal)] px-3 py-1.5 text-xs font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10"
          >
            Nạp mẫu: đồ thị vô hướng dạng ma trận kề
          </button>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Biến: <code>int</code>, <code>string</code>, <code>intArray</code>, <code>intMatrix</code>, <code>undirectedGraphMatrix</code>. Dùng {"{ten_bien}"} trong template; kích thước mảng có thể tham chiếu biến int đã khai báo trước đó.
          </p>
          <label className="mt-3 block text-xs font-medium">
            Lời giải tham chiếu
            <textarea
              rows={9}
              maxLength={64_000}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={language === "CPP" ? "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // ...\n}" : "import sys\n\ndef main():\n    # ...\n    pass\n\nmain()"}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--paper)] p-2 font-mono text-xs"
              spellCheck={false}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium">
              Ngôn ngữ
              <select value={language} onChange={(event) => setLanguage(event.target.value === "PYTHON" ? "PYTHON" : "CPP")} className="mt-1 block rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-2">
                <option value="CPP">C++17</option>
                <option value="PYTHON">Python 3</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Số test (1–10)
              <input type="number" min={1} max={10} value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-1 block w-24 rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-2" />
            </label>
            <label className="text-xs font-medium">
              Kiểu sinh
              <select value={mode} onChange={(event) => setMode(event.target.value === "random" || event.target.value === "edge" ? event.target.value : "mixed")} className="mt-1 block rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-2">
                <option value="mixed">Biên + ngẫu nhiên</option>
                <option value="random">Ngẫu nhiên</option>
                <option value="edge">Min/max luân phiên</option>
              </select>
            </label>
            <button type="button" disabled={count < 1 || count > 10} onClick={generate} className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              Sinh input
            </button>
          </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {generated.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm font-medium text-emerald-700">
              Đã sinh {generated.length} input. Chạy lời giải trên máy bạn, nhập output rồi mới thêm test.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadInputs} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm font-medium text-[var(--navy)]">
                Tải input (.zip)
              </button>
              <button type="button" disabled={runPending || (!problemId && !runEndpoint) || !source.trim()} onClick={() => void runReferenceSolution()} className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {runPending ? "Đang chạy..." : "Chạy code qua API dự phòng"}
              </button>
              <button type="button" disabled={missingOutputs > 0} onClick={() => { onAddCases(generated); setGenerated([]); setMessage("Đã thêm test vào danh sách; nhấn Lưu thay đổi để lưu bộ test."); }} className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {missingOutputs > 0 ? `Còn thiếu ${missingOutputs} output` : `Thêm ${generated.length} test vào đề`}
              </button>
            </div>
          </div>
          {generated.map((testCase, index) => (
            <div key={`${index}-${testCase.input}`} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Input {index + 1}
                <textarea readOnly rows={5} value={testCase.input} className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--background)] p-2 font-mono text-xs" />
              </label>
              <label className="text-xs font-medium">Output từ lời giải của bạn
                <textarea required rows={5} maxLength={24_000} value={testCase.output} onChange={(event) => updateOutput(index, event.target.value)} placeholder="Dán output tương ứng tại đây" className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--background)] p-2 font-mono text-xs" />
              </label>
            </div>
          ))}
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
