"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminGachaTickets({
  userId,
  initialTickets,
}: {
  userId: string;
  initialTickets: number;
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const changed = tickets !== initialTickets;

  async function save() {
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gachaTickets: tickets }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(result.error ?? "Không thể cập nhật lượt quay.");
        return;
      }

      setTickets(result.gachaTickets);
      setMessage("Đã lưu");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Không thể kết nối máy chủ.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-48 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          aria-label="Số lượt quay"
          type="number"
          min={0}
          max={1_000_000}
          step={1}
          value={tickets}
          onChange={(event) => {
            const value = Number(event.target.value);
            setTickets(Number.isFinite(value) ? value : 0);
            setMessage("");
          }}
          className="w-24 rounded-md border border-[var(--line)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--ink)]"
        />
        <span className="text-xs text-[var(--muted)]">🎟</span>
        <button
          type="button"
          disabled={!changed || pending || !Number.isInteger(tickets) || tickets < 0 || tickets > 1_000_000}
          onClick={save}
          className="rounded-md bg-[var(--teal)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
      {message && (
        <p role={error ? "alert" : "status"} className={`text-xs ${error ? "text-rose-700" : "text-emerald-700"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
