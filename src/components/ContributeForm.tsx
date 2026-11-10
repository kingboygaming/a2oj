"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseTestCaseZip } from "@/lib/testcase-zip";
import {
  MAX_PROBLEM_STATEMENT_PDF_SIZE,
  PDF_STATEMENT_PLACEHOLDER,
} from "@/lib/problem-statement-pdf-constants";
import { uploadProblemStatementPdf } from "@/lib/problem-statement-pdf-upload";
import { TestGeneratorPanel } from "@/components/TestGeneratorPanel";

const DEFAULT_STATEMENT_TEMPLATE = "Cho $n$. Tính ...\n\n## Input\n\n## Output\n";

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
  ioMode?: string | null;
  inputFile?: string | null;
  outputFile?: string | null;
  statementPdfPath?: string | null;
  judgeType?: string | null;
  interactorSource?: string | null;
  scoringMode?: string | null;
  gachaAcRewardMin?: number;
  gachaAcRewardMax?: number;
  gachaPacRewardMin?: number;
  gachaPacRewardMax?: number;
  specialGachaCardId?: string | null;
  specialGachaDropRate?: number;
  heuristicTolerancePercent?: number;
  achievementBadgeTitle?: string | null;
  achievementBadgeDescription?: string | null;
  achievementScoreThreshold?: number | null;
  tags?: { name: string }[];
  testCases: Case[];
};

export function ContributeForm({
  problem,
  returnUrl,
  specialCards = [],
}: {
  problem?: ProblemDraft;
  returnUrl?: string;
  specialCards?: { id: string; name: string; rarity: string }[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(problem?.slug ?? "");
  const [title, setTitle] = useState(problem?.title ?? "");
  const [statement, setStatement] = useState(
    problem?.statement ?? DEFAULT_STATEMENT_TEMPLATE,
  );
  const [difficulty, setDifficulty] = useState(problem?.difficulty ?? "EASY");
  const [tagsInput, setTagsInput] = useState(problem?.tags?.map((tag) => tag.name).join(", ") ?? "");
  const [timeLimitMs, setTimeLimitMs] = useState(problem?.timeLimitMs ?? 1000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(problem?.memoryLimitMb ?? 256);
  const [ioMode, setIoMode] = useState<"STDIO" | "FILE">(
    problem?.judgeType !== "INTERACTIVE" && problem?.ioMode === "FILE" ? "FILE" : "STDIO",
  );
  const [judgeType, setJudgeType] = useState<"STANDARD" | "HEURISTIC" | "INTERACTIVE">(
    problem?.judgeType === "HEURISTIC" || problem?.judgeType === "INTERACTIVE" ? problem.judgeType : "STANDARD",
  );
  const [interactorSource, setInteractorSource] = useState(problem?.interactorSource ?? "");
  const [scoringMode, setScoringMode] = useState<"ICPC" | "VNOI">(
    problem?.scoringMode === "VNOI" ? "VNOI" : "ICPC",
  );
  const [gachaAcRewardMin, setGachaAcRewardMin] = useState(problem?.gachaAcRewardMin ?? 5);
  const [gachaAcRewardMax, setGachaAcRewardMax] = useState(problem?.gachaAcRewardMax ?? 10);
  const [gachaPacRewardMin, setGachaPacRewardMin] = useState(problem?.gachaPacRewardMin ?? 0);
  const [gachaPacRewardMax, setGachaPacRewardMax] = useState(problem?.gachaPacRewardMax ?? 5);
  const [specialGachaCardId, setSpecialGachaCardId] = useState(problem?.specialGachaCardId ?? "");
  const [specialGachaDropRate, setSpecialGachaDropRate] = useState(problem?.specialGachaDropRate ?? 0);
  const [inputFile, setInputFile] = useState(problem?.inputFile ?? "");
  const [heuristicTolerancePercent, setHeuristicTolerancePercent] = useState(
    problem?.heuristicTolerancePercent ?? 5,
  );
  const [achievementBadgeTitle, setAchievementBadgeTitle] = useState(problem?.achievementBadgeTitle ?? "");
  const [achievementBadgeDescription, setAchievementBadgeDescription] = useState(problem?.achievementBadgeDescription ?? "");
  const [achievementScoreThreshold, setAchievementScoreThreshold] = useState(problem?.achievementScoreThreshold ?? 90);
  const [outputFile, setOutputFile] = useState(problem?.outputFile ?? "");
  const [statementPdfFile, setStatementPdfFile] = useState<File | null>(null);
  const [uploadedPdfPath, setUploadedPdfPath] = useState("");
  const [hasStatementPdf, setHasStatementPdf] = useState(Boolean(problem?.statementPdfPath));
  const [removeStatementPdf, setRemoveStatementPdf] = useState(false);
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
      if (gachaAcRewardMin > gachaAcRewardMax) {
        setError("Lượt tối đa khi AC phải lớn hơn hoặc bằng lượt tối thiểu.");
        return;
      }
      if (gachaPacRewardMin > gachaPacRewardMax) {
        setError("Lượt tối đa khi PAC phải lớn hơn hoặc bằng lượt tối thiểu.");
        return;
      }
      if (specialGachaDropRate > 0 && !specialGachaCardId) {
        setError("Hãy chọn thẻ đặc biệt trước khi đặt xác suất rơi.");
        return;
      }

      const hasPdfAfterSave = Boolean(
        statementPdfFile || uploadedPdfPath || (hasStatementPdf && !removeStatementPdf),
      );
      if (
        (!statement.trim() || statement.trim() === PDF_STATEMENT_PLACEHOLDER) &&
        !hasPdfAfterSave
      ) {
        setError("Hãy nhập nội dung đề hoặc đính kèm file PDF.");
        return;
      }

      let nextStatementPdfPath = removeStatementPdf && !statementPdfFile
        ? null
        : problem?.statementPdfPath ?? null;
      if (statementPdfFile) {
        nextStatementPdfPath = uploadedPdfPath ||
          await uploadProblemStatementPdf(statementPdfFile);
        setUploadedPdfPath(nextStatementPdfPath);
      }

      const res = await fetch(
        problem ? `/api/problems/${problem.id}` : "/api/problems",
        {
          method: problem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            title,
            statement: statement.trim() || PDF_STATEMENT_PLACEHOLDER,
            statementPdfPath: nextStatementPdfPath,
            difficulty,
            tags: [...new Set(tagsInput.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
            timeLimitMs,
            memoryLimitMb,
            judgeType,
            interactorSource: judgeType === "INTERACTIVE" ? interactorSource : null,
            scoringMode,
            gachaAcRewardMin,
            gachaAcRewardMax,
            gachaPacRewardMin,
            gachaPacRewardMax,
            specialGachaCardId: specialGachaCardId || null,
            specialGachaDropRate,
            heuristicTolerancePercent,
            achievementBadgeTitle: judgeType === "HEURISTIC" ? achievementBadgeTitle.trim() || null : null,
            achievementBadgeDescription: judgeType === "HEURISTIC" ? achievementBadgeDescription.trim() || null : null,
            achievementScoreThreshold: judgeType === "HEURISTIC" && achievementBadgeTitle.trim() ? achievementScoreThreshold : null,
            ioMode,
            inputFile:
              ioMode === "FILE"
                ? inputFile.trim() || `${slug.trim().toUpperCase()}.INP`
                : null,
            outputFile:
              ioMode === "FILE"
                ? outputFile.trim() || `${slug.trim().toUpperCase()}.OUT`
                : null,
            testCases: cases,
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const fieldErrors = Object.values(data.details?.fieldErrors ?? {})
          .flat()
          .filter((message): message is string => typeof message === "string");
        setError(
          fieldErrors.length
            ? `${data.error ?? "Dữ liệu đề bài không hợp lệ."} ${fieldErrors.join(" ")}`
            : data.error ?? (problem ? "Không thể cập nhật đề." : "Không tạo được đề."),
        );
        return;
      }

      setHasStatementPdf(Boolean(nextStatementPdfPath));
      setRemoveStatementPdf(false);
      setStatementPdfFile(null);
      setUploadedPdfPath("");
      const nextSlug = data.slug ?? slug;
      if (returnUrl) {
        const targetUrl = problem?.slug
          ? returnUrl.replace(`/problems/${problem.slug}`, `/problems/${nextSlug}`)
          : returnUrl;
        router.push(targetUrl);
      } else {
        router.push(problem ? `/problems/${nextSlug}` : `/problems/${data.slug}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        setError("Lưu quá thời gian chờ. Bộ test quá lớn — hãy thử giảm số lượng hoặc kích thước test.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể kết nối để lưu đề. Hãy thử lại.",
        );
      }
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
      <label className="block text-sm">
        Tags
        <input
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="dp, binary search, data structure"
          list="problem-tag-suggestions"
        />
        <datalist id="problem-tag-suggestions">
          {["dp", "data structure", "binary search", "greedy", "sort", "two pointer", "math", "implementation", "graph", "string", "backtracking", "bitmask", "tree", "interactive", "có hướng dẫn", "ts10"].map((tag) => <option key={tag} value={tag} />)}
        </datalist>
        <span className="mt-1 block text-xs text-[var(--muted)]">Nhập tối đa 10 tag, phân cách bằng dấu phẩy. Có thể tạo tag mới.</span>
      </label>
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

      {/* Phương thức chấm bài (Judge Type) */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">Kiểu tính điểm</p>
          <p className="text-xs text-[var(--muted)]">
            ICPC yêu cầu AC toàn bộ test; VNOI tính điểm từng test và cho phép điểm một phần.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="scoringMode"
              value="ICPC"
              checked={scoringMode === "ICPC"}
              onChange={() => setScoringMode("ICPC")}
              className="mt-1 accent-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">ICPC</strong>
              <span className="block text-xs text-[var(--muted)]">Đúng toàn bộ test mới được tính AC.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="scoringMode"
              value="VNOI"
              checked={scoringMode === "VNOI"}
              onChange={() => setScoringMode("VNOI")}
              className="mt-1 accent-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">VNOI</strong>
              <span className="block text-xs text-[var(--muted)]">Cộng điểm các test đúng theo trọng số đã đặt.</span>
            </span>
          </label>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--navy)]">Thưởng gacha cho bài này</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Mặc định AC nhận 5–10 lượt, PAC nhận 0–5 lượt. Mỗi tài khoản chỉ nhận thưởng AC/PAC một lần cho bài này.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberRange label="Lượt khi AC" min={gachaAcRewardMin} max={gachaAcRewardMax} onMinChange={setGachaAcRewardMin} onMaxChange={setGachaAcRewardMax} />
          <NumberRange label="Lượt khi PAC" min={gachaPacRewardMin} max={gachaPacRewardMax} onMinChange={setGachaPacRewardMin} onMaxChange={setGachaPacRewardMax} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Thẻ đặc biệt có thể rơi
            <select value={specialGachaCardId} onChange={(event) => setSpecialGachaCardId(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm">
              <option value="">Không chọn thẻ</option>
              {specialCards.map((card) => <option key={card.id} value={card.id}>{card.name} · {card.rarity}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Xác suất rơi thẻ (%)
            <input type="number" min={0} max={100} step={0.01} value={specialGachaDropRate} onChange={(event) => setSpecialGachaDropRate(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
          </label>
        </div>
        {specialCards.length === 0 && <p className="text-xs text-[var(--muted)]">Quản trị viên chưa tạo thẻ đặc biệt nào.</p>}
      </section>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-[var(--navy)]">
            Phương thức chấm điểm (Judge Type)
          </label>
          <p className="text-xs text-[var(--muted)]">
            Chọn cách hệ thống chấm bài và tính điểm cho các test case.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="judgeType"
              value="STANDARD"
              checked={judgeType === "STANDARD"}
              onChange={() => setJudgeType("STANDARD")}
              className="text-[var(--teal)] focus:ring-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">Bộ chấm chuẩn (Standard / Exact Match)</strong>
              <span className="block text-xs text-[var(--muted)]">
                So khớp chính xác từng token output (bỏ qua khoảng trắng thừa). Đúng hoàn toàn mới đạt điểm test.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="judgeType"
              value="HEURISTIC"
              checked={judgeType === "HEURISTIC"}
              onChange={() => setJudgeType("HEURISTIC")}
              className="text-[var(--teal)] focus:ring-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">Bộ chấm Heuristic (Chấm xấp xỉ / Tối ưu)</strong>
              <span className="block text-xs text-[var(--muted)]">
                So khớp độ gần đúng của các giá trị số để cho điểm theo tỉ lệ (dành cho bài toán tối ưu, xấp xỉ).
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="judgeType"
              value="INTERACTIVE"
              checked={judgeType === "INTERACTIVE"}
              onChange={() => {
                setJudgeType("INTERACTIVE");
                setIoMode("STDIO");
              }}
              className="text-[var(--teal)] focus:ring-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">Interactive (tương tác)</strong>
              <span className="block text-xs text-[var(--muted)]">
                Chạy contestant và interactor đồng thời; tương thích ICPC.
              </span>
            </span>
          </label>
        </div>
        {judgeType === "INTERACTIVE" && (
          <label className="block text-sm">
            Interactor C++17
            <textarea
              required
              maxLength={64_000}
              rows={12}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs"
              value={interactorSource}
              onChange={(event) => setInteractorSource(event.target.value)}
              placeholder={'#include <iostream>\nint main(int argc, char** argv) {\n  // argv[1]: input, argv[2]: đáp án; stdin: output contestant\n  // stdout: phản hồi gửi cho contestant; return 0 nếu chấp nhận\n}'}
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              `argv[1]` là input, `argv[2]` là đáp án; đọc output contestant từ stdin và gửi phản hồi qua stdout. Thoát mã 0 là AC, mã khác là WA.
            </span>
          </label>
        )}
        {judgeType === "HEURISTIC" && (
          <>
          <label className="block max-w-xs text-sm">
            Sai số cho phép để đạt đủ điểm (%)
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              value={heuristicTolerancePercent}
              onChange={(e) => setHeuristicTolerancePercent(Number(e.target.value))}
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Kết quả lệch tối đa mức này vẫn được đủ điểm; vượt mức sẽ được tính điểm theo độ gần. Mặc định 5%.
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Tên huy hiệu theo điểm heuristic<input maxLength={80} value={achievementBadgeTitle} onChange={(e) => setAchievementBadgeTitle(e.target.value)} placeholder="Ví dụ: Bậc thầy tối ưu" className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2" /></label>
            <label className="text-sm">Điểm tối thiểu để nhận huy hiệu<input type="number" min={1} max={10000} value={achievementScoreThreshold} onChange={(e) => setAchievementScoreThreshold(Number(e.target.value))} disabled={!achievementBadgeTitle.trim()} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 disabled:opacity-50" /></label>
            <label className="text-sm sm:col-span-2">Mô tả huy hiệu<input maxLength={180} value={achievementBadgeDescription} onChange={(e) => setAchievementBadgeDescription(e.target.value)} placeholder="Đạt điểm cao ở bài heuristic này" disabled={!achievementBadgeTitle.trim()} className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 disabled:opacity-50" /></label>
          </div>
          <p className="text-xs text-[var(--muted)]">Bỏ trống tên nếu bài này không có huy hiệu riêng. Ai đạt điểm tối thiểu trong một lần nộp đã chấm xong sẽ nhận huy hiệu.</p>
          </>
        )}
      </div>

      {/* Phương thức nhập / xuất (I/O) */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-[var(--navy)]">
            Phương thức nhập / xuất dữ liệu
          </label>
          <p className="text-xs text-[var(--muted)]">
            Tùy chọn chấm bằng luồng chuẩn (stdin, stdout) hoặc nhập xuất qua file (.INP, .OUT).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="ioMode"
              value="STDIO"
              checked={ioMode === "STDIO"}
              onChange={() => setIoMode("STDIO")}
              className="text-[var(--teal)] focus:ring-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">Chuẩn (stdin / stdout)</strong>
              <span className="block text-xs text-[var(--muted)]">
                Nhập từ bàn phím (cin/scanf), in ra màn hình (cout/printf)
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="ioMode"
              value="FILE"
              checked={ioMode === "FILE"}
              disabled={judgeType === "INTERACTIVE"}
              onChange={() => setIoMode("FILE")}
              className="text-[var(--teal)] focus:ring-[var(--teal)]"
            />
            <span>
              <strong className="text-[var(--navy)]">Tệp tin (File I/O)</strong>
              <span className="block text-xs text-[var(--muted)]">
                Đọc từ file .INP và ghi ra file .OUT (chuẩn thi HSG / Olympic)
              </span>
            </span>
          </label>
        </div>

        {ioMode === "FILE" && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 rounded-lg border border-[var(--line)] bg-white p-3">
            <label className="text-xs font-medium">
              Tên file Input (tệp dữ liệu vào)
              <input
                type="text"
                placeholder={slug.trim() ? `${slug.trim().toUpperCase()}.INP` : "INPUT.INP"}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-[var(--navy)]"
                value={inputFile}
                onChange={(e) => setInputFile(e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                Mặc định: <code className="font-mono">{slug.trim() ? `${slug.trim().toUpperCase()}.INP` : "SLUG.INP"}</code> nếu để trống
              </span>
            </label>

            <label className="text-xs font-medium">
              Tên file Output (tệp kết quả ra)
              <input
                type="text"
                placeholder={slug.trim() ? `${slug.trim().toUpperCase()}.OUT` : "OUTPUT.OUT"}
                className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-1.5 font-mono text-xs text-[var(--navy)]"
                value={outputFile}
                onChange={(e) => setOutputFile(e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                Mặc định: <code className="font-mono">{slug.trim() ? `${slug.trim().toUpperCase()}.OUT` : "SLUG.OUT"}</code> nếu để trống
              </span>
            </label>
          </div>
        )}
      </div>
      <label className="block text-sm">
        Đề bài (Markdown + KaTeX){hasStatementPdf || statementPdfFile ? " — có thể để trống khi dùng PDF" : ""}
        <textarea
          required={!statementPdfFile && (!hasStatementPdf || removeStatementPdf)}
          rows={12}
          className="mt-1 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
      </label>
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--paper)] p-4">
        <label className="block text-sm font-medium text-[var(--navy)]">
          Đề bài từ file PDF (không cần nhập lại nội dung dài)
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-strong)] file:px-3 file:py-2 file:text-white"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setError("");
              setUploadedPdfPath("");
              setStatementPdfFile(null);
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
              if (!problem && statement === DEFAULT_STATEMENT_TEMPLATE) {
                setStatement(PDF_STATEMENT_PLACEHOLDER);
              }
              setStatementPdfFile(file);
              setRemoveStatementPdf(false);
            }}
          />
        </label>
        <p className="mt-2 text-xs text-[var(--muted)]">
          PDF tối đa 20 MB được lưu riêng tư trên Supabase Storage và hiển thị trực tiếp trong trang bài. Không trích xuất/OCR nội dung.
        </p>
        {(statementPdfFile || hasStatementPdf) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[var(--teal)]">
              {statementPdfFile ? `PDF mới: ${statementPdfFile.name}` : "Đã có PDF đính kèm"}
            </span>
            {hasStatementPdf && (
              <label className="inline-flex items-center gap-2 text-rose-700">
                <input
                  type="checkbox"
                  checked={removeStatementPdf}
                  onChange={(event) => setRemoveStatementPdf(event.target.checked)}
                />
                Gỡ PDF khi lưu
              </label>
            )}
          </div>
        )}
      </div>

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
            File ZIP tối đa 50 MB, mỗi test tối đa 30 MB, tổng giải nén tối đa 200 MB và tối đa 100 cặp.
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
        <TestGeneratorPanel
          problemId={problem?.id}
          onAddCases={(generated) => {
            setCases((current) => [
              ...current,
              ...generated.map((testCase, index) => ({
                ...testCase,
                isSample: false,
                points: 100,
                name: `Test sinh ${current.length + index + 1}`,
              })),
            ]);
          }}
        />
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
                  placeholder={judgeType === "INTERACTIVE" ? "Answer file cho interactor" : "Output"}
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

function NumberRange({
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
