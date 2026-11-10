"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseTestCaseZip } from "@/lib/testcase-zip";
import {
  MAX_PROBLEM_STATEMENT_PDF_SIZE,
  PDF_STATEMENT_PLACEHOLDER,
} from "@/lib/problem-statement-pdf-constants";
import { uploadProblemStatementPdf } from "@/lib/problem-statement-pdf-upload";
import { TestGeneratorPanel } from "@/components/TestGeneratorPanel";

const DEFAULT_CONTEST_STATEMENT =
  "Cho số nguyên $n$. In ra kết quả...\n\n## Input\n\n## Output\n";

export type TestCaseDraft = {
  input: string;
  output: string;
  isSample: boolean;
  points: number;
};

export type ProblemDraft = {
  slug: string;
  title: string;
  statement: string;
  statementPdfFile?: File | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  timeLimitMs: number;
  memoryLimitMb: number;
  judgeType?: "STANDARD" | "HEURISTIC" | "INTERACTIVE";
  interactorSource?: string;
  scoringMode?: "ICPC" | "VNOI";
  gachaAcRewardMin?: number;
  gachaAcRewardMax?: number;
  gachaPacRewardMin?: number;
  gachaPacRewardMax?: number;
  specialGachaCardId?: string | null;
  specialGachaDropRate?: number;
  ioMode?: "STDIO" | "FILE";
  inputFile?: string;
  outputFile?: string;
  testCases: TestCaseDraft[];
};

export type InitialContestData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  testLimit: number;
  rankPointsEnabled?: boolean;
  scoringMode?: "ICPC" | "VNOI";
  hasPassword?: boolean;
  gachaAcRewardMin?: number;
  gachaAcRewardMax?: number;
  gachaPacRewardMin?: number;
  gachaPacRewardMax?: number;
  specialGachaCardId?: string | null;
  specialGachaDropRate?: number;
  problemIds: string[];
  problemCustomTitles?: Record<string, string>;
  problemJudgeTypes?: Record<string, "STANDARD" | "HEURISTIC" | "INTERACTIVE">;
  problemIoModes?: Record<string, "STDIO" | "FILE">;
  problemInputFiles?: Record<string, string>;
  problemOutputFiles?: Record<string, string>;
};

function createProblemDraft(): ProblemDraft {
  return {
    slug: "",
    title: "",
    statement: DEFAULT_CONTEST_STATEMENT,
    statementPdfFile: null,
    difficulty: "EASY",
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    judgeType: "STANDARD",
    interactorSource: "",
    scoringMode: "ICPC",
    ioMode: "STDIO",
    inputFile: "",
    outputFile: "",
    testCases: [
      { input: "", output: "", isSample: true, points: 0 },
      { input: "", output: "", isSample: false, points: 100 },
    ],
  };
}

function toLocalDatetimeString(isoString: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ContestForm({
  availableProblems,
  initialData,
  specialCards = [],
}: {
  availableProblems: {
    id: string;
    slug: string;
    title: string;
    difficulty?: string;
    judgeType?: string | null;
    ioMode?: string | null;
    inputFile?: string | null;
    outputFile?: string | null;
  }[];
  initialData?: InitialContestData;
  specialCards?: { id: string; name: string; rarity: string }[];
}) {
  const router = useRouter();
  const statementPdfInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const isEditing = Boolean(initialData);

  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [startAt, setStartAt] = useState(
    initialData?.startAt ? toLocalDatetimeString(initialData.startAt) : "",
  );
  const [endAt, setEndAt] = useState(
    initialData?.endAt ? toLocalDatetimeString(initialData.endAt) : "",
  );
  const [testLimit, setTestLimit] = useState(initialData?.testLimit ?? 5);
  const [rankPointsEnabled, setRankPointsEnabled] = useState(initialData?.rankPointsEnabled ?? false);
  const [scoringMode, setScoringMode] = useState<"ICPC" | "VNOI">(
    initialData?.scoringMode === "VNOI" ? "VNOI" : "ICPC",
  );
  const [gachaAcRewardMin, setGachaAcRewardMin] = useState(initialData?.gachaAcRewardMin ?? 5);
  const [gachaAcRewardMax, setGachaAcRewardMax] = useState(initialData?.gachaAcRewardMax ?? 10);
  const [gachaPacRewardMin, setGachaPacRewardMin] = useState(initialData?.gachaPacRewardMin ?? 0);
  const [gachaPacRewardMax, setGachaPacRewardMax] = useState(initialData?.gachaPacRewardMax ?? 5);
  const [specialGachaCardId, setSpecialGachaCardId] = useState(initialData?.specialGachaCardId ?? "");
  const [specialGachaDropRate, setSpecialGachaDropRate] = useState(initialData?.specialGachaDropRate ?? 0);
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [problemIds, setProblemIds] = useState<string[]>(initialData?.problemIds ?? []);
  const [problemCustomTitles, setProblemCustomTitles] = useState<Record<string, string>>(
    initialData?.problemCustomTitles ?? {},
  );
  const [problemJudgeTypes, setProblemJudgeTypes] = useState<Record<string, "STANDARD" | "HEURISTIC" | "INTERACTIVE">>(
    initialData?.problemJudgeTypes ?? {},
  );
  const [problemIoModes, setProblemIoModes] = useState<Record<string, "STDIO" | "FILE">>(
    initialData?.problemIoModes ?? {},
  );
  const [problemInputFiles, setProblemInputFiles] = useState<Record<string, string>>(
    initialData?.problemInputFiles ?? {},
  );
  const [problemOutputFiles, setProblemOutputFiles] = useState<Record<string, string>>(
    initialData?.problemOutputFiles ?? {},
  );
  const [newProblems, setNewProblems] = useState<ProblemDraft[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [zipMessages, setZipMessages] = useState<Record<number, string>>({});

  function toggle(id: string) {
    setProblemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function moveProblemUp(index: number) {
    if (index === 0) return;
    setProblemIds((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  function moveProblemDown(index: number) {
    if (index === problemIds.length - 1) return;
    setProblemIds((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  }

  function updateProblem(index: number, patch: Partial<ProblemDraft>) {
    setNewProblems((current) =>
      current.map((problem, i) => (i === index ? { ...problem, ...patch } : problem)),
    );
  }

  function GachaRange({
    label,
    min,
    max,
    onMinChange,
    onMaxChange,
  }: {
    label: string;
    min: number;
    max: number;
    onMinChange: (value: number) => void;
    onMaxChange: (value: number) => void;
  }) {
    return (
      <fieldset className="rounded-lg border border-[var(--line)] p-3">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[var(--muted)]">Tối thiểu<input type="number" min={0} max={1000} value={min} onChange={(event) => onMinChange(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]" /></label>
          <label className="text-xs text-[var(--muted)]">Tối đa<input type="number" min={0} max={1000} value={max} onChange={(event) => onMaxChange(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]" /></label>
        </div>
      </fieldset>
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

  async function handleImportZip(problemIndex: number, file?: File) {
    if (!file) return;
    try {
      const imported = parseTestCaseZip(new Uint8Array(await file.arrayBuffer()));
      setNewProblems((current) =>
        current.map((prob, i) => {
          if (i !== problemIndex) return prob;
          return {
            ...prob,
            testCases: [
              ...prob.testCases,
              ...imported.map((tc) => ({
                input: tc.input,
                output: tc.output,
                isSample: false,
                points: tc.points,
              })),
            ],
          };
        }),
      );
      setZipMessages((prev) => ({
        ...prev,
        [problemIndex]: `Đã nhập thành công ${imported.length} test từ file ${file.name}!`,
      }));
    } catch (err) {
      setZipMessages((prev) => ({
        ...prev,
        [problemIndex]: err instanceof Error ? err.message : "Lỗi đọc file zip testcase.",
      }));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");

    try {
      const endpoint = isEditing ? `/api/contests/${initialData!.id}` : "/api/contests";
      const method = isEditing ? "PATCH" : "POST";

      const finalJudgeTypes: Record<string, "STANDARD" | "HEURISTIC" | "INTERACTIVE"> = {};
      const finalIoModes: Record<string, "STDIO" | "FILE"> = {};
      const finalInputFiles: Record<string, string> = {};
      const finalOutputFiles: Record<string, string> = {};

      for (const id of problemIds) {
        const p = availableProblems.find((item) => item.id === id);
        const jType = p?.judgeType === "INTERACTIVE"
          ? "INTERACTIVE"
          : problemJudgeTypes[id] || (p?.judgeType === "HEURISTIC" ? "HEURISTIC" : "STANDARD");
        finalJudgeTypes[id] = jType;
        const mode = problemIoModes[id] || (p?.ioMode === "FILE" ? "FILE" : "STDIO");
        finalIoModes[id] = jType === "INTERACTIVE" ? "STDIO" : mode;
        if (mode === "FILE" && jType !== "INTERACTIVE") {
          finalInputFiles[id] =
            problemInputFiles[id]?.trim() ||
            p?.inputFile ||
            (p?.slug ? `${p.slug.toUpperCase()}.INP` : "INPUT.INP");
          finalOutputFiles[id] =
            problemOutputFiles[id]?.trim() ||
            p?.outputFile ||
            (p?.slug ? `${p.slug.toUpperCase()}.OUT` : "OUTPUT.OUT");
        }
      }

      const formattedNewProblems = await Promise.all(newProblems.map(async (prob) => {
        const jType = prob.judgeType ?? "STANDARD";
        const mode = prob.ioMode ?? "STDIO";
        const defaultInpFile = prob.slug ? `${prob.slug.toUpperCase()}.INP` : "INPUT.INP";
        const defaultOutFile = prob.slug ? `${prob.slug.toUpperCase()}.OUT` : "OUTPUT.OUT";
        const { statementPdfFile, ...problemData } = prob;
        const statementPdfPath = statementPdfFile
          ? await uploadProblemStatementPdf(statementPdfFile)
          : null;
        return {
          ...problemData,
          statement: problemData.statement.trim() ||
            (statementPdfPath ? PDF_STATEMENT_PLACEHOLDER : ""),
          statementPdfPath,
          judgeType: jType,
          scoringMode,
          gachaAcRewardMin,
          gachaAcRewardMax,
          gachaPacRewardMin,
          gachaPacRewardMax,
          specialGachaCardId: specialGachaCardId || null,
          specialGachaDropRate,
          ioMode: jType === "INTERACTIVE" ? "STDIO" : mode,
          inputFile: jType !== "INTERACTIVE" && mode === "FILE" ? (prob.inputFile?.trim() || defaultInpFile) : null,
          outputFile: jType !== "INTERACTIVE" && mode === "FILE" ? (prob.outputFile?.trim() || defaultOutFile) : null,
        };
      }));

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          description,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          testLimit: Number(testLimit),
          rankPointsEnabled,
          scoringMode,
          password: password.trim() || undefined,
          removePassword,
          problemIds,
          problemCustomTitles,
          problemJudgeTypes: finalJudgeTypes,
          problemIoModes: finalIoModes,
          problemInputFiles: finalInputFiles,
          problemOutputFiles: finalOutputFiles,
          newProblems: formattedNewProblems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (isEditing ? "Không lưu được contest." : "Không tạo được contest."));
        return;
      }
      router.push(`/contests/${data.slug}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể kết nối đến máy chủ. Hãy kiểm tra lại và thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 space-y-4">
        <h2 className="text-base font-semibold text-[var(--navy)]">Thông tin kỳ thi</h2>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Slug contest (URL)
            <input
              required
              minLength={2}
              maxLength={64}
              pattern="[a-z0-9\-]+"
              placeholder="vd: contest-thang-10"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </label>

          <label className="block text-sm">
            Tên kỳ thi
            <input
              required
              minLength={3}
              placeholder="vd: Kỳ thi Lập trình Tin học Trẻ"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          Mô tả kỳ thi
          <textarea
            required
            rows={3}
            placeholder="Nội dung, thể lệ, đối tượng tham gia kỳ thi..."
            className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Thời gian bắt đầu
            <input
              required
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>

          <label className="text-sm">
            Thời gian kết thúc
            <input
              required
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="flex items-center gap-1.5 font-medium text-[var(--teal)]">
              ⚙ Số test chấm trong contest
            </span>
            <input
              required
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold"
              value={testLimit}
              onChange={(e) => setTestLimit(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {testLimit === 0 ? "Chấm tất cả test" : `Chỉ chấm tối đa ${testLimit} test đầu tiên`}
            </span>
          </label>
        </div>

        <fieldset className="rounded-lg border border-[var(--line)] p-3">
          <legend className="px-1 text-sm font-medium">Kiểu tính điểm contest</legend>
          <div className="flex flex-wrap gap-5">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="contestScoringMode"
                value="ICPC"
                checked={scoringMode === "ICPC"}
                onChange={() => setScoringMode("ICPC")}
                className="mt-1 accent-[var(--teal)]"
              />
              <span>
                <strong>ICPC</strong>
                <span className="block text-xs text-[var(--muted)]">Xếp theo số bài AC, sau đó penalty.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="contestScoringMode"
                value="VNOI"
                checked={scoringMode === "VNOI"}
                onChange={() => setScoringMode("VNOI")}
                className="mt-1 accent-[var(--teal)]"
              />
              <span>
                <strong>VNOI</strong>
                <span className="block text-xs text-[var(--muted)]">Xếp theo tổng điểm cao nhất; hòa thì ai đạt điểm đó sớm hơn xếp trên.</span>
              </span>
            </label>
          </div>
        </fieldset>

        <label className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--background)] p-3 text-sm">
          <input type="checkbox" checked={rankPointsEnabled} onChange={(event) => setRankPointsEnabled(event.target.checked)} className="mt-0.5 size-4 accent-[var(--teal)]" />
          <span><strong>Tính điểm rank cho contest này</strong><span className="mt-0.5 block text-xs text-[var(--muted)]">Khi contest kết thúc, top 3 nhận lần lượt 100, 70 và 50 điểm. Contest luyện tập có thể để tắt.</span></span>
        </label>

        <section className="space-y-4 rounded-lg border border-[var(--line)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--navy)]">Thưởng gacha contest</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Mỗi thí sinh nhận tối đa một lần thưởng PAC và một lần thưởng AC cho mỗi bài trong contest này.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <GachaRange label="Lượt khi AC" min={gachaAcRewardMin} max={gachaAcRewardMax} onMinChange={setGachaAcRewardMin} onMaxChange={setGachaAcRewardMax} />
            <GachaRange label="Lượt khi PAC" min={gachaPacRewardMin} max={gachaPacRewardMax} onMinChange={setGachaPacRewardMin} onMaxChange={setGachaPacRewardMax} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Thẻ đặc biệt
              <select value={specialGachaCardId} onChange={(event) => setSpecialGachaCardId(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm">
                <option value="">Không chọn thẻ</option>
                {specialCards.map((card) => <option key={card.id} value={card.id}>{card.name} · {card.rarity}</option>)}
              </select>
            </label>
            <label className="text-sm">Xác suất rơi thẻ (%)
              <input type="number" min={0} max={100} step={0.01} value={specialGachaDropRate} onChange={(event) => setSpecialGachaDropRate(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
            </label>
          </div>
          {specialCards.length === 0 && <p className="text-xs text-[var(--muted)]">Quản trị viên chưa tạo thẻ đặc biệt nào.</p>}
        </section>

        <div className="space-y-2 border-t border-[var(--line)] pt-4">
          <label className="block text-sm">
            Mật khẩu contest <span className="text-xs text-[var(--muted)]">(không bắt buộc)</span>
            <input
              type="password"
              autoComplete="new-password"
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={removePassword}
              placeholder={initialData?.hasPassword ? "Để trống để giữ mật khẩu hiện tại" : "Để trống nếu không đặt mật khẩu"}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Thí sinh cần nhập mật khẩu để xem đề sau khi contest bắt đầu.
            </span>
          </label>
          {initialData?.hasPassword && (
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={removePassword}
                onChange={(event) => {
                  setRemovePassword(event.target.checked);
                  if (event.target.checked) setPassword("");
                }}
                className="size-4 accent-[var(--teal)]"
              />
              Gỡ mật khẩu hiện tại
            </label>
          )}
        </div>
      </div>

      {/* Danh sách bài tập đã chọn & sắp xếp */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--navy)]">
            Thứ tự đề bài trong kỳ thi ({problemIds.length} bài)
          </h2>
          <span className="text-xs text-[var(--muted)]">Ký hiệu bài A, B, C... tự động gắn theo thứ tự này</span>
        </div>

        {problemIds.length > 0 ? (
          <div className="space-y-3">
            {problemIds.map((id, idx) => {
              const p = availableProblems.find((item) => item.id === id);
              const customTitleVal = problemCustomTitles[id] ?? "";
              return (
                <div
                  key={id}
                  className="rounded-lg border border-[var(--line)] bg-white p-3 text-sm space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xs font-bold text-white shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <div>
                        <span className="font-semibold text-[var(--navy)]">{p?.title ?? id}</span>
                        <span className="ml-2 font-mono text-xs text-[var(--muted)]">({p?.slug ?? id})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveProblemUp(idx)}
                        className="rounded border border-[var(--line)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--paper)] disabled:opacity-30"
                        title="Lên trên"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === problemIds.length - 1}
                        onClick={() => moveProblemDown(idx)}
                        className="rounded border border-[var(--line)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--paper)] disabled:opacity-30"
                        title="Xuống dưới"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="rounded border border-rose-200 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/60 text-xs">
                    <span className="text-[var(--muted)] whitespace-nowrap">Tên hiển thị trong contest:</span>
                    <input
                      type="text"
                      placeholder={`Mặc định: "${p?.title ?? id}"`}
                      className="w-full rounded border border-[var(--line)] px-2.5 py-1 text-xs"
                      value={customTitleVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProblemCustomTitles((prev) => ({
                          ...prev,
                          [id]: val,
                        }));
                      }}
                    />
                  </div>

                  {/* Cấu hình Nhập / Xuất & Bộ chấm */}
                  <div className="grid gap-2 pt-2 border-t border-[var(--line)]/60 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[var(--muted)] font-medium">Bộ chấm bài thi:</span>
                      {p?.judgeType === "INTERACTIVE" ? (
                        <label className="flex items-center gap-1">
                          <input type="radio" name={`judge-type-${id}`} checked readOnly />
                          <span>Interactive (cấu hình tại bài gốc)</span>
                        </label>
                      ) : <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`judge-type-${id}`}
                            value="STANDARD"
                            checked={(problemJudgeTypes[id] ?? (p?.judgeType || "STANDARD")) === "STANDARD"}
                            onChange={() =>
                              setProblemJudgeTypes((prev) => ({ ...prev, [id]: "STANDARD" }))
                            }
                          />
                          <span>Chuẩn (Standard)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`judge-type-${id}`}
                            value="HEURISTIC"
                            checked={(problemJudgeTypes[id] ?? (p?.judgeType || "STANDARD")) === "HEURISTIC"}
                            onChange={() =>
                              setProblemJudgeTypes((prev) => ({ ...prev, [id]: "HEURISTIC" }))
                            }
                          />
                          <span>Heuristic (Xấp xỉ)</span>
                        </label>
                      </div>}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[var(--muted)] font-medium">Nhập / xuất bài thi:</span>
                      {(problemJudgeTypes[id] ?? p?.judgeType) === "INTERACTIVE" ? (
                        <span className="text-cyan-700">Interactive stdin/stdout</span>
                      ) : <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`io-mode-${id}`}
                            value="STDIO"
                            checked={(problemIoModes[id] ?? (p?.ioMode || "STDIO")) === "STDIO"}
                            onChange={() =>
                              setProblemIoModes((prev) => ({ ...prev, [id]: "STDIO" }))
                            }
                          />
                          <span>Chuẩn (stdin / stdout)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`io-mode-${id}`}
                            value="FILE"
                            checked={(problemIoModes[id] ?? (p?.ioMode || "STDIO")) === "FILE"}
                            onChange={() =>
                              setProblemIoModes((prev) => ({ ...prev, [id]: "FILE" }))
                            }
                          />
                          <span>Tệp tin (File I/O)</span>
                        </label>
                      </div>}
                    </div>

                    {(problemJudgeTypes[id] ?? p?.judgeType) !== "INTERACTIVE" && (problemIoModes[id] ?? (p?.ioMode || "STDIO")) === "FILE" && (
                      <div className="grid gap-2 sm:grid-cols-2 rounded border border-[var(--line)] bg-[var(--background)] p-2">
                        <div>
                          <label className="block text-[11px] text-[var(--muted)] mb-1">
                            File vào (Input file):
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs bg-white"
                            placeholder={p?.inputFile || (p?.slug ? `${p.slug.toUpperCase()}.INP` : "INPUT.INP")}
                            value={problemInputFiles[id] ?? ""}
                            onChange={(e) =>
                              setProblemInputFiles((prev) => ({ ...prev, [id]: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[var(--muted)] mb-1">
                            File ra (Output file):
                          </label>
                          <input
                            type="text"
                            className="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs bg-white"
                            placeholder={p?.outputFile || (p?.slug ? `${p.slug.toUpperCase()}.OUT` : "OUTPUT.OUT")}
                            value={problemOutputFiles[id] ?? ""}
                            onChange={(e) =>
                              setProblemOutputFiles((prev) => ({ ...prev, [id]: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Chưa có bài nào được chọn trong contest.</p>
        )}

        <fieldset className="mt-4 rounded-lg border border-[var(--line)] p-4">
          <legend className="px-1 text-sm font-medium">Chọn thêm từ kho bài tập có sẵn</legend>
          {availableProblems.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Chưa có bài tập thường nào trong hệ thống.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 max-h-60 overflow-y-auto pr-1">
              {availableProblems.map((problem) => {
                const checked = problemIds.includes(problem.id);
                return (
                  <label
                    key={problem.id}
                    className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--teal)] bg-[var(--teal)]/5 text-[var(--navy)] font-medium"
                        : "border-[var(--line)] hover:bg-black/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(problem.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-mono text-[var(--muted)]">{problem.slug}</p>
                      <p className="truncate">{problem.title}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>

      {/* Tạo bài mới riêng cho contest */}
      <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--navy)]">
              Tạo bài riêng cho contest (Test & đề bài độc lập)
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Các bài này độc lập, chỉ xuất hiện và chấm trong contest, không ảnh hưởng đến kho bài tập chung.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[var(--teal)] bg-[var(--teal)]/10 px-3 py-1.5 text-xs font-medium text-[var(--teal)] hover:bg-[var(--teal)]/20"
            onClick={() => setNewProblems((current) => [...current, createProblemDraft()])}
          >
            + Thêm bài mới vào contest
          </button>
        </div>

        {newProblems.map((problem, problemIndex) => (
          <fieldset
            key={problemIndex}
            className="space-y-4 rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
              <span className="font-semibold text-sm text-[var(--navy)]">
                Bài mới {String.fromCharCode(65 + problemIds.length + problemIndex)}
              </span>
              <button
                type="button"
                className="text-xs text-rose-700 hover:underline"
                onClick={() =>
                  setNewProblems((current) => current.filter((_, i) => i !== problemIndex))
                }
              >
                ✕ Xóa bài này
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium">
                Slug
                <input
                  required
                  minLength={2}
                  maxLength={64}
                  pattern="[a-z0-9\-]+"
                  className="mt-1 w-full rounded border border-[var(--line)] px-2.5 py-1.5 font-mono text-xs"
                  value={problem.slug}
                  onChange={(e) => updateProblem(problemIndex, { slug: e.target.value.toLowerCase() })}
                />
              </label>

              <label className="text-xs font-medium sm:col-span-2">
                Tên bài
                <input
                  required
                  minLength={2}
                  className="mt-1 w-full rounded border border-[var(--line)] px-2.5 py-1.5 text-xs"
                  value={problem.title}
                  onChange={(e) => updateProblem(problemIndex, { title: e.target.value })}
                />
              </label>

              <label className="text-xs font-medium">
                Độ khó
                <select
                  className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
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

              <label className="text-xs font-medium">
                Time limit (ms)
                <input
                  required
                  min={1}
                  type="number"
                  className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
                  value={problem.timeLimitMs}
                  onChange={(e) => updateProblem(problemIndex, { timeLimitMs: Number(e.target.value) })}
                />
              </label>

              <label className="text-xs font-medium">
                Memory limit (MB)
                <input
                  required
                  min={1}
                  type="number"
                  className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs"
                  value={problem.memoryLimitMb}
                  onChange={(e) => updateProblem(problemIndex, { memoryLimitMb: Number(e.target.value) })}
                />
              </label>
            </div>

            {/* Bộ chấm bài */}
            <div className="rounded border border-[var(--line)] bg-gray-50/50 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[var(--navy)]">Bộ chấm bài:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`new-prob-judge-${problemIndex}`}
                      value="STANDARD"
                      checked={(problem.judgeType ?? "STANDARD") === "STANDARD"}
                      onChange={() => updateProblem(problemIndex, { judgeType: "STANDARD" })}
                    />
                    <span>Chuẩn (Standard)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`new-prob-judge-${problemIndex}`}
                      value="HEURISTIC"
                      checked={problem.judgeType === "HEURISTIC"}
                      onChange={() => updateProblem(problemIndex, { judgeType: "HEURISTIC" })}
                    />
                    <span>Heuristic (Xấp xỉ)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`new-prob-judge-${problemIndex}`}
                      value="INTERACTIVE"
                      checked={problem.judgeType === "INTERACTIVE"}
                      onChange={() =>
                        updateProblem(problemIndex, { judgeType: "INTERACTIVE", ioMode: "STDIO" })
                      }
                    />
                    <span>Interactive</span>
                  </label>
                </div>
              </div>
              {problem.judgeType === "INTERACTIVE" && (
                <label className="block">
                  Interactor C++17
                  <textarea
                    required
                    maxLength={64_000}
                    rows={8}
                    className="mt-1 w-full rounded border border-[var(--line)] p-2 font-mono text-xs"
                    value={problem.interactorSource ?? ""}
                    onChange={(event) => updateProblem(problemIndex, { interactorSource: event.target.value })}
                    placeholder={'// argv[1]: input, argv[2]: đáp án; stdin: câu trả lời contestant; stdout: phản hồi\nint main(int argc, char** argv) { /* return 0 nếu chấp nhận */ }'}
                  />
                  <span className="mt-1 block text-[11px] text-[var(--muted)]">
                    Đọc contestant từ stdin, gửi phản hồi qua stdout. `argv[1]` là input, `argv[2]` là đáp án; mã thoát 0 = AC, mã khác = WA.
                  </span>
                </label>
              )}
            </div>

            {/* Phương thức vào / ra */}
            <div className="rounded border border-[var(--line)] bg-gray-50/50 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[var(--navy)]">Phương thức nhập / xuất:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`new-prob-io-${problemIndex}`}
                      value="STDIO"
                      checked={(problem.ioMode ?? "STDIO") === "STDIO"}
                      onChange={() => updateProblem(problemIndex, { ioMode: "STDIO" })}
                    />
                    <span>Chuẩn (stdin / stdout)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`new-prob-io-${problemIndex}`}
                      value="FILE"
                      disabled={problem.judgeType === "INTERACTIVE"}
                      checked={problem.ioMode === "FILE"}
                      onChange={() => updateProblem(problemIndex, { ioMode: "FILE" })}
                    />
                    <span>Tệp tin (File I/O)</span>
                  </label>
                </div>
              </div>

              {problem.ioMode === "FILE" && problem.judgeType !== "INTERACTIVE" && (
                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">
                      Tên file Input:
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs bg-white"
                      placeholder={problem.slug ? `${problem.slug.toUpperCase()}.INP` : "INPUT.INP"}
                      value={problem.inputFile ?? ""}
                      onChange={(e) => updateProblem(problemIndex, { inputFile: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted)] mb-1">
                      Tên file Output:
                    </label>
                    <input
                      type="text"
                      className="w-full rounded border border-[var(--line)] px-2 py-1 font-mono text-xs bg-white"
                      placeholder={problem.slug ? `${problem.slug.toUpperCase()}.OUT` : "OUTPUT.OUT"}
                      value={problem.outputFile ?? ""}
                      onChange={(e) => updateProblem(problemIndex, { outputFile: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <label className="block text-xs font-medium">
              Đề bài (Markdown + KaTeX)
              <textarea
                required={!problem.statementPdfFile}
                minLength={problem.statementPdfFile ? undefined : 10}
                rows={5}
                className="mt-1 w-full rounded border border-[var(--line)] p-2 font-mono text-xs"
                value={problem.statement}
                onChange={(e) => updateProblem(problemIndex, { statement: e.target.value })}
              />
            </label>
            <div className="rounded-lg border border-dashed border-[var(--line)] p-3 text-xs">
              <label className="block font-medium">
                Đề bài PDF (không cần nhập lại nội dung dài)
                <input
                  ref={(element) => {
                    statementPdfInputs.current[problemIndex] = element;
                  }}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    if (!file) return;
                    if (!file.name.toLowerCase().endsWith(".pdf")) {
                      setError("Chỉ hỗ trợ file có đuôi .pdf.");
                      event.currentTarget.value = "";
                      return;
                    }
                    if (file.size === 0 || file.size > MAX_PROBLEM_STATEMENT_PDF_SIZE) {
                      setError("PDF đề bài phải có dung lượng tối đa 20 MB.");
                      event.currentTarget.value = "";
                      return;
                    }
                    setError("");
                    updateProblem(problemIndex, {
                      statementPdfFile: file,
                      ...(problem.statement === DEFAULT_CONTEST_STATEMENT
                        ? { statement: PDF_STATEMENT_PLACEHOLDER }
                        : {}),
                    });
                  }}
                />
              </label>
              <p className="mt-2 text-[var(--muted)]">
                PDF tối đa 20 MB. Đề bài sẽ được lưu riêng tư và hiển thị trong trang bài của contest.
              </p>
              {problem.statementPdfFile && (
                <div className="mt-2 flex items-center gap-3 text-[var(--teal)]">
                  <span className="break-all">PDF đã chọn: {problem.statementPdfFile.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-rose-700 hover:underline"
                    onClick={() => {
                      updateProblem(problemIndex, { statementPdfFile: null });
                      const input = statementPdfInputs.current[problemIndex];
                      if (input) input.value = "";
                    }}
                  >
                    Gỡ PDF
                  </button>
                </div>
              )}
            </div>

            {/* Testcase & Import ZIP */}
            <div className="space-y-3 rounded-lg border border-dashed border-[var(--line)] p-3 bg-gray-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[var(--navy)]">
                    Bộ Testcase ({problem.testCases.length} test)
                  </h3>
                  <button
                    type="button"
                    className="rounded bg-[var(--teal)]/10 px-2 py-0.5 text-xs text-[var(--teal)] hover:bg-[var(--teal)]/20"
                    onClick={() =>
                      updateProblem(problemIndex, {
                        testCases: [
                          ...problem.testCases,
                          { input: "", output: "", isSample: false, points: 100 },
                        ],
                      })
                    }
                  >
                    + Thêm 1 test
                  </button>
                </div>

                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded border border-[var(--teal)] px-2.5 py-1 text-xs font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10">
                  📁 Nhập test từ file ZIP (.in / .out)
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportZip(problemIndex, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {zipMessages[problemIndex] && (
                <p className="text-xs text-[var(--teal)] font-medium">
                  {zipMessages[problemIndex]}
                </p>
              )}

              {problem.ioMode !== "FILE" && (
                <TestGeneratorPanel
                  runEndpoint="/api/contests/generate-output"
                  onAddCases={(generated) => {
                    updateProblem(problemIndex, {
                      testCases: [
                        ...problem.testCases,
                        ...generated.map((testCase) => ({
                          ...testCase,
                          isSample: false,
                          points: 100,
                        })),
                      ],
                    });
                  }}
                />
              )}
              {problem.ioMode === "FILE" && (
                <p className="rounded-md border border-amber-300/50 bg-amber-50 p-2 text-xs text-amber-800">
                  Công cụ sinh output tự động chưa hỗ trợ bài dùng File I/O.
                </p>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {problem.testCases.map((testCase, testIndex) => (
                  <div key={testIndex} className="rounded border border-[var(--line)] bg-white p-2">
                    <div className="mb-1.5 flex items-center gap-3 text-xs">
                      <span className="font-semibold text-gray-700">Test {testIndex + 1}</span>
                      <label className="flex items-center gap-1 cursor-pointer">
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
                        <span>Sample</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <span>Điểm:</span>
                        <input
                          type="number"
                          min={0}
                          className="w-14 rounded border border-[var(--line)] px-1 py-0.5 text-xs text-center"
                          value={testCase.points}
                          onChange={(e) =>
                            updateTestCase(problemIndex, testIndex, { points: Number(e.target.value) })
                          }
                        />
                      </label>
                      {problem.testCases.length > 1 && (
                        <button
                          type="button"
                          className="ml-auto text-xs text-rose-700 hover:underline"
                          onClick={() =>
                            updateProblem(problemIndex, {
                              testCases: problem.testCases.filter((_, i) => i !== testIndex),
                            })
                          }
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <textarea
                        rows={2}
                        placeholder="Input"
                        className="rounded border border-[var(--line)] p-1.5 font-mono text-xs"
                        value={testCase.input}
                        onChange={(e) =>
                          updateTestCase(problemIndex, testIndex, { input: e.target.value })
                        }
                      />
                      <textarea
                        rows={2}
                        placeholder={problem.judgeType === "INTERACTIVE" ? "Answer file cho interactor" : "Output"}
                        className="rounded border border-[var(--line)] p-1.5 font-mono text-xs"
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
          </fieldset>
        ))}
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--surface-strong)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-60"
        >
          {pending
            ? "Đang lưu..."
            : isEditing
              ? "Cập nhật kỳ thi"
              : "Tạo kỳ thi"}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--paper)]"
        >
          Hủy bỏ
        </button>
      </div>
    </form>
  );
}
