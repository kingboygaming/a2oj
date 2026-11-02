"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCORING_MODES, type ScoringMode } from "@/lib/scoring";

async function updateScoringMode(body: {
  scope: "problem";
  problemId: string;
  scoringMode: ScoringMode;
}) {
  const response = await fetch("/api/admin/problems/scoring-mode", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error ?? "Không thể cập nhật chế độ chấm.");
  }
}

export function ProblemScoringModeQuickEdit({
  problemId,
  scoringMode,
}: {
  problemId: string;
  scoringMode: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ScoringMode>(
    scoringMode === "VNOI" ? "VNOI" : "ICPC",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onChange(nextMode: ScoringMode) {
    const previousMode = mode;
    setMode(nextMode);
    setPending(true);
    setError("");
    try {
      await updateScoringMode({
        scope: "problem",
        problemId,
        scoringMode: nextMode,
      });
      router.refresh();
    } catch (cause) {
      setMode(previousMode);
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật chế độ chấm.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="sr-only" htmlFor={`scoring-mode-${problemId}`}>
        Kiểu chấm bài
      </label>
      <select
        id={`scoring-mode-${problemId}`}
        value={mode}
        disabled={pending}
        onChange={(event) =>
          void onChange(event.target.value === "VNOI" ? "VNOI" : "ICPC")
        }
        className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 text-sm disabled:opacity-60"
      >
        {SCORING_MODES.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && <p role="alert" className="mt-1 max-w-36 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function BulkProblemScoringModeQuickEdit() {
  const router = useRouter();
  const [mode, setMode] = useState<ScoringMode>("ICPC");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function applyToAll() {
    if (!window.confirm(`Đổi chế độ chấm của tất cả bài tập sang ${mode}?`)) return;

    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/problems/scoring-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", scoringMode: mode }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Không thể cập nhật chế độ chấm.");
      }
      setMessage(`Đã cập nhật ${result.updated} bài tập sang ${mode}.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật chế độ chấm.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <span className="text-sm font-medium text-[var(--navy)]">Đổi nhanh tất cả bài tập sang</span>
      <label className="sr-only" htmlFor="bulk-scoring-mode">Kiểu chấm cho tất cả bài tập</label>
      <select
        id="bulk-scoring-mode"
        value={mode}
        disabled={pending}
        onChange={(event) =>
          setMode(event.target.value === "VNOI" ? "VNOI" : "ICPC")
        }
        className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 text-sm"
      >
        {SCORING_MODES.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => void applyToAll()}
        className="rounded-md bg-[var(--teal)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang cập nhật..." : "Áp dụng cho tất cả"}
      </button>
      {message && <p role="status" className="w-full text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
