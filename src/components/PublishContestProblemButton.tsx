"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublishContestProblemButton({
  contestId,
  problemId,
}: {
  contestId: string;
  problemId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function publishProblem() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/contests/${contestId}/publish-problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemIds: [problemId] }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không thể đưa bài vào kho đề.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không thể kết nối để cập nhật bài.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={publishProblem}
        className="rounded border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-2 py-1 text-[11px] font-medium text-[var(--teal)] hover:bg-[var(--teal)]/20 disabled:opacity-60"
      >
        {pending ? "Đang lưu…" : "Đưa ra kho đề"}
      </button>
      {error && <span role="alert" className="text-[11px] text-rose-700">{error}</span>}
    </span>
  );
}
