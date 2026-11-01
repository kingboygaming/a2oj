"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContestPasswordForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/contests/${encodeURIComponent(contestId)}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Không mở được contest.");
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError("Không thể kết nối để xác nhận mật khẩu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={unlock} className="mt-4 max-w-md space-y-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <label className="block text-sm font-medium text-[var(--navy)]">
        Contest này cần mật khẩu
        <input
          required
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2"
        />
      </label>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending || !password}
        className="rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang xác nhận..." : "Mở contest"}
      </button>
    </form>
  );
}
