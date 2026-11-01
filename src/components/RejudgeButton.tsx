"use client";

import { useState } from "react";

interface RejudgeButtonProps {
  contestId: string;
}

type State = "idle" | "loading" | "success" | "error";

export function RejudgeButton({ contestId }: RejudgeButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleRejudge() {
    const confirmed = window.confirm(
      "Chấm lại toàn bộ bài nộp (full test) cho tất cả thí sinh?\n" +
        "Thao tác này sẽ cập nhật điểm chính thức của kỳ thi.\n\n" +
        "Nhấn OK để xác nhận.",
    );
    if (!confirmed) return;

    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/contests/${contestId}/rejudge`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setState("error");
        setMessage(data.error || data.message || "Có lỗi xảy ra.");
      } else {
        setState("success");
        setMessage(data.message || "Chấm lại thành công!");
      }
    } catch {
      setState("error");
      setMessage("Không thể kết nối đến máy chủ.");
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleRejudge}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === "loading" ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            Đang chấm...
          </>
        ) : (
          "🔄 Chấm lại (Full test)"
        )}
      </button>
      {message && (
        <span
          className={`text-xs ${state === "success" ? "text-green-500" : "text-red-500"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
