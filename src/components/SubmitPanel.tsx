"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CodeEditor, defaultSource } from "./CodeEditor";
import { VerdictBadge } from "./VerdictBadge";
import { EditorSettingsPanel } from "./EditorSettingsPanel";
import { playSound } from "@/lib/sound";

type Language = "CPP" | "PYTHON";
type Sample = { id: string; label: string; input: string; output: string };
type LocalRun = {
  verdict: "OK" | "TLE" | "RTE" | "CE";
  output: string;
  error: string;
  timeMs: number;
};
type SampleRun = { sampleId: string; result: LocalRun };
type DraftSnapshot = { source: string; error: string };
const draftListeners = new Map<string, Set<() => void>>();
const memoryDrafts = new Map<string, string>();
const draftSnapshots = new Map<string, DraftSnapshot>();

export function SubmitPanel({
  problemId,
  userId,
  loggedIn,
  contestId,
  samples,
  judgeType,
  ioMode,
  inputFile,
  outputFile,
}: {
  problemId: string;
  userId: string;
  loggedIn: boolean;
  contestId?: string;
  samples: Sample[];
  judgeType?: string | null;
  ioMode?: string | null;
  inputFile?: string | null;
  outputFile?: string | null;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("CPP");
  const [selectedSample, setSelectedSample] = useState(samples[0]?.id ?? "custom");
  const [input, setInput] = useState(samples[0]?.input ?? "");
  const [pending, setPending] = useState(false);
  const [runPending, setRunPending] = useState(false);
  const [runAllPending, setRunAllPending] = useState(false);
  const [runResult, setRunResult] = useState<LocalRun | null>(null);
  const [sampleRunResults, setSampleRunResults] = useState<SampleRun[] | null>(null);
  const [result, setResult] = useState<{
    id: string;
    verdict: string;
    score: number;
    timeMs: number | null;
    log: string;
    gachaReward?: { rewardType: string; ticketsAwarded: number; card: { name: string; rarity: string } | null } | null;
  } | null>(null);
  const [error, setError] = useState("");

  const pendingSubmissionId = result?.id;
  const pendingSubmissionVerdict = result?.verdict;
  useEffect(() => {
    if (
      !pendingSubmissionId ||
      !pendingSubmissionVerdict ||
      !["QUEUED", "RUNNING"].includes(pendingSubmissionVerdict)
    ) return;

    let active = true;
    let inFlight = false;
    const checkStatus = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/submissions/${pendingSubmissionId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        setResult((current) => current?.id === pendingSubmissionId
          ? {
              id: current.id,
              verdict: data.verdict,
              score: data.score,
              timeMs: data.timeMs,
              log: data.log ?? current.log,
              gachaReward: data.gachaReward ?? current.gachaReward,
            }
          : current);
        if (!["QUEUED", "RUNNING"].includes(data.verdict)) {
          if (data.verdict === "AC") playSound("ac");
          else if (data.verdict === "WA") playSound("wa");
          else if (data.verdict === "CE") playSound("ce");
          else if (data.verdict === "TLE") playSound("tle");
          router.refresh();
        }
      } catch {
        // Retry on the next polling interval.
      } finally {
        inFlight = false;
      }
    };

    void checkStatus();
    const timer = window.setInterval(checkStatus, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pendingSubmissionId, pendingSubmissionVerdict, router]);

  const draftKey = getDraftKey(userId, problemId, language);
  const subscribe = useCallback(
    (listener: () => void) => subscribeToDraft(draftKey, listener),
    [draftKey],
  );
  const getSnapshot = useCallback(() => getDraftSnapshot(draftKey, language), [draftKey, language]);
  const getServerSnapshot = useCallback(
    () => makeDraftSnapshot(`server:${language}`, defaultSource(language), ""),
    [language],
  );
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const source = draft.source;

  function changeLanguage(next: Language) {
    setLanguage(next);
    setRunResult(null);
    setSampleRunResults(null);
  }

  function changeSample(sampleId: string) {
    setSelectedSample(sampleId);
    const sample = samples.find((item) => item.id === sampleId);
    if (sample) setInput(sample.input);
    setRunResult(null);
    setSampleRunResults(null);
  }

  async function runCode() {
    setRunPending(true);
    setError("");
    setRunResult(null);
    setSampleRunResults(null);
    try {
      const res = await fetch("/api/ide/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, language, source, input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Chạy thử thất bại.");
        return;
      }
      setRunResult(data);
    } catch {
      setError("Không thể kết nối để chạy thử.");
    } finally {
      setRunPending(false);
    }
  }

  async function runAllSamples() {
    setRunAllPending(true);
    setError("");
    setRunResult(null);
    setSampleRunResults(null);
    try {
      const res = await fetch("/api/ide/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, language, source, input: "", allSamples: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Chạy sample thất bại.");
        return;
      }
      setSampleRunResults(data.results);
    } catch {
      setError("Không thể kết nối để chạy tất cả sample.");
    } finally {
      setRunAllPending(false);
    }
  }

  async function submit() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId, language, source, contestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nộp bài thất bại.");
        return;
      }
      setResult(data);
      if (data?.verdict === "AC") playSound("ac");
      else if (data?.verdict === "WA") playSound("wa");
      else if (data?.verdict === "CE") playSound("ce");
      else if (data?.verdict === "TLE") playSound("tle");
      router.refresh();
    } catch {
      setError("Không thể kết nối để nộp bài.");
    } finally {
      setPending(false);
    }
  }

  if (!loggedIn) {
    return (
      <aside className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <p className="text-sm text-[var(--muted)]">Đăng nhập để mở editor và nộp bài.</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium text-[var(--teal)]">
          Đến trang đăng nhập
        </Link>
      </aside>
    );
  }

  return (
    <aside className="code-workspace min-w-0 overflow-hidden rounded-2xl border border-slate-700 shadow-xl">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 font-mono text-sm font-bold text-sky-300">
            {"</>"}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold tracking-tight">Live IDE</h2>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Viết code, chạy thử input hoặc kiểm tra toàn bộ sample
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EditorSettingsPanel />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Ngôn ngữ
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value as Language)}
              className="rounded-lg border border-white/10 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none transition focus:border-sky-400/60"
            >
              <option value="CPP">C++17</option>
              <option value="PYTHON">Python 3</option>
            </select>
          </label>
        </div>
      </div>

      {judgeType === "HEURISTIC" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 bg-purple-500/10 px-4 py-2.5 text-xs text-purple-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-purple-300">🎯 Chấm Heuristic:</span>
            <span>Bài tập tính điểm theo độ lệch xấp xỉ so với kết quả mẫu cho từng test.</span>
          </div>
          <span className="text-[11px] text-purple-300/80">Có tính điểm thành phần (partial score)</span>
        </div>
      )}

      {ioMode === "FILE" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-300">📁 Chấm File I/O:</span>
            <span>
              Đọc từ{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono font-bold text-amber-300">{inputFile || "INPUT.INP"}</code>
              {", ghi ra "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono font-bold text-amber-300">{outputFile || "OUTPUT.OUT"}</code>
            </span>
          </div>
          <span className="text-[11px] text-amber-300/80">Bắt buộc đọc từ {inputFile || "INPUT.INP"} và ghi ra {outputFile || "OUTPUT.OUT"}</span>
        </div>
      )}

      <div className="p-3 sm:p-5">
        <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#111827] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-400" />
              <span className="font-mono text-xs font-medium text-slate-200">
                {language === "CPP" ? "main.cpp" : "main.py"}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Source code
            </span>
          </div>
        <CodeEditor
          language={language}
          value={source}
          onChange={(value) => {
            try {
              saveDraft(draftKey, value);
              setError("");
            } catch {
              setError("Không thể lưu code nháp trên trình duyệt.");
            }
            setRunResult(null);
            setSampleRunResults(null);
          }}
        />
        </section>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#111827] px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span className="font-mono text-sky-300">›_</span>
                Input
              </h3>
              <select
                aria-label="Chọn input mẫu"
                value={selectedSample}
                onChange={(event) => changeSample(event.target.value)}
                className="max-w-48 rounded-md border border-white/10 bg-[#1f2937] px-2 py-1.5 text-xs text-white outline-none focus:border-sky-400/60"
              >
                {samples.map((sample, index) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.label || `Sample ${index + 1}`}
                  </option>
                ))}
                <option value="custom">Tự nhập input</option>
              </select>
            </div>
            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSelectedSample("custom");
                setRunResult(null);
                setSampleRunResults(null);
              }}
              aria-label="Dữ liệu đầu vào"
              spellCheck={false}
              className="min-h-36 w-full resize-y bg-transparent p-3 font-mono text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600 focus:ring-0"
              placeholder="Nhập dữ liệu đầu vào..."
            />
            {selectedSample !== "custom" &&
              samples.find((sample) => sample.id === selectedSample) && (
                <p className="border-t border-white/5 px-3 py-2 text-[11px] text-slate-500">
                  Input mẫu. Có thể sửa để chạy dữ liệu riêng.
                </p>
              )}
          </section>
          <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]">
            <h3 className="flex items-center gap-2 border-b border-white/10 bg-[#111827] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <span className="font-mono text-emerald-300">●</span>
              Output
            </h3>
            <div
              aria-live="polite"
              className={`min-h-36 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 ${
                runResult?.verdict === "CE"
                  ? "text-rose-200"
                  : "text-slate-200"
              }`}
            >
              {runPending
                ? "Đang biên dịch và chạy..."
                : runResult
                  ? runResult.verdict === "CE"
                    ? `Lỗi biên dịch (CE)\n\n${runResult.error || "Không có thông báo lỗi từ compiler."}`
                    : runResult.output || "(Không có output)"
                  : "Output sẽ hiển thị ở đây sau khi chạy thử."}
            </div>
            {runResult && (
              <p
                className={`border-t border-white/5 px-3 py-2 text-[11px] ${
                  runResult.verdict === "OK" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {runResult.verdict} · {runResult.timeMs} ms
              </p>
            )}
            {runResult?.error && runResult.verdict !== "CE" && (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap border-t border-rose-400/10 bg-rose-400/5 px-3 py-2 text-xs text-rose-200">
                {runResult.error}
              </pre>
            )}
            {runResult &&
            selectedSample !== "custom" &&
            samples.find((sample) => sample.id === selectedSample) && (
              <div className="mt-3 border-t border-white/10 pt-2">
                <p className="text-xs font-medium text-white/65">Output mong đợi</p>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-white/75">
                  {samples.find((sample) => sample.id === selectedSample)?.output}
                </pre>
                {runResult.verdict === "OK" && (
                  <p
                    className={`mt-1 text-xs ${
                      normalizeOutput(runResult.output) ===
                      normalizeOutput(
                        samples.find((sample) => sample.id === selectedSample)?.output ?? "",
                      )
                        ? "text-emerald-300"
                        : "text-amber-200"
                    }`}
                  >
                    {normalizeOutput(runResult.output) ===
                    normalizeOutput(
                      samples.find((sample) => sample.id === selectedSample)?.output ?? "",
                    )
                      ? "Output khớp sample"
                      : "Output chưa khớp sample"}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        {runAllPending && (
          <p role="status" className="mt-3 text-xs text-white/65">
          Đang biên dịch và chạy lần lượt {samples.length} sample...
          </p>
        )}
        {sampleRunResults && (
          <section className="mt-4 space-y-3" aria-live="polite">
          <h3 className="text-sm font-medium">
            Kết quả:{" "}
            {
              sampleRunResults.filter((item) => {
                const sample = samples.find((candidate) => candidate.id === item.sampleId);
                return (
                  item.result.verdict === "OK" &&
                  sample &&
                  normalizeOutput(item.result.output) === normalizeOutput(sample.output)
                );
              }).length
            }/{sampleRunResults.length} sample khớp
          </h3>
          {sampleRunResults.map(({ sampleId, result: sampleResult }, index) => {
            const sample = samples.find((item) => item.id === sampleId);
            const matched =
              sampleResult.verdict === "OK" &&
              sample !== undefined &&
              normalizeOutput(sampleResult.output) === normalizeOutput(sample.output);
            return (
              <article
                key={sampleId}
                className="rounded-md border border-white/10 bg-[#0b1220] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <h4 className="font-medium">{sample?.label || `Sample ${index + 1}`}</h4>
                  <span className={matched ? "text-emerald-300" : "text-rose-300"}>
                    {sampleResult.verdict} · {sampleResult.timeMs} ms
                    {sampleResult.verdict === "OK"
                      ? matched
                        ? " · Khớp output"
                        : " · Chưa khớp output"
                      : ""}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] uppercase text-white/50">Output của bạn</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                      {sampleResult.output || "(Không có output)"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase text-white/50">Output mong đợi</p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                      {sample?.output ?? ""}
                    </pre>
                  </div>
                </div>
                {sampleResult.error && (
                  <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-rose-200">
                    {sampleResult.error}
                  </pre>
                )}
              </article>
            );
          })}
          </section>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-rose-950/60 p-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        {draft.error && (
          <p role="alert" className="mt-3 rounded-md bg-amber-950/60 p-2 text-sm text-amber-200">
            {draft.error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={runCode}
            disabled={runPending || runAllPending || pending}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {runPending ? "Đang chạy..." : "▶ Chạy thử"}
          </button>
          {samples.length > 0 && (
            <button
              type="button"
              onClick={runAllSamples}
              disabled={runPending || runAllPending || pending}
              className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              {runAllPending ? "Đang chạy sample..." : `▶ Chạy tất cả sample (${samples.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || runPending || runAllPending}
            className="rounded-md bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-[var(--navy)] disabled:opacity-50"
          >
            {pending ? "Đang chấm..." : "Nộp bài"}
          </button>
        </div>
      {result && (
        <div className="mt-3 rounded-lg border border-white/10 bg-[#1f2937] p-3 text-sm">
          <div className="flex items-center justify-between">
            <VerdictBadge verdict={result.verdict} />
            <span className="font-mono text-xs">
              {result.score} điểm · {result.timeMs ?? 0} ms
            </span>
          </div>
          {["QUEUED", "RUNNING"].includes(result.verdict) ? (
            <p role="status" className="mt-2 text-xs text-[var(--muted)]">
              {result.verdict === "QUEUED" ? "Đang chờ đến lượt chấm..." : "Đang chấm bài..."}
            </p>
          ) : (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
              {result.log}
            </pre>
          )}
          {result.gachaReward && (
            <p className="mt-2 rounded-md bg-amber-400/10 px-2.5 py-2 text-xs font-medium text-amber-200">
              🎟 Nhận {result.gachaReward.ticketsAwarded} lượt gacha
              {result.gachaReward.card ? ` và thẻ đặc biệt ${result.gachaReward.card.name}!` : "."}
            </p>
          )}
          <Link href={`/submissions/${result.id}`} className="mt-2 inline-block text-xs text-emerald-300">
            Chi tiết submission
          </Link>
        </div>
      )}
      </div>
    </aside>
  );
}

function getDraftKey(userId: string, problemId: string, language: Language) {
  return `a2oj:draft:${encodeURIComponent(userId)}:${encodeURIComponent(problemId)}:${language}`;
}

function subscribeToDraft(key: string, listener: () => void) {
  const listeners = draftListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  draftListeners.set(key, listeners);

  function onStorageChange(event: StorageEvent) {
    if (event.key === key) {
      if (event.newValue === null) memoryDrafts.delete(key);
      else memoryDrafts.set(key, event.newValue);
      listener();
    } else if (event.key === null) {
      memoryDrafts.delete(key);
      listener();
    }
  }
  window.addEventListener("storage", onStorageChange);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) draftListeners.delete(key);
    window.removeEventListener("storage", onStorageChange);
  };
}

function getDraftSnapshot(key: string, language: Language): DraftSnapshot {
  if (typeof window === "undefined") {
    return makeDraftSnapshot(key, defaultSource(language), "");
  }
  const memoryDraft = memoryDrafts.get(key);
  try {
    const saved = window.localStorage.getItem(key);
    return makeDraftSnapshot(key, saved ?? memoryDraft ?? defaultSource(language), "");
  } catch {
    return makeDraftSnapshot(
      key,
      memoryDraft ?? defaultSource(language),
      "Không thể đọc code nháp đã lưu; thay đổi mới sẽ chỉ được giữ trong phiên hiện tại nếu trình duyệt chặn lưu trữ.",
    );
  }
}

function makeDraftSnapshot(key: string, source: string, error: string): DraftSnapshot {
  const current = draftSnapshots.get(key);
  if (current?.source === source && current.error === error) return current;
  const snapshot = { source, error };
  draftSnapshots.set(key, snapshot);
  return snapshot;
}

function saveDraft(key: string, source: string) {
  memoryDrafts.set(key, source);
  try {
    window.localStorage.setItem(key, source);
  } finally {
    for (const listener of draftListeners.get(key) ?? []) listener();
  }
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}
