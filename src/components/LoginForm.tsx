"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Đăng nhập thất bại.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Tên tài khoản
        </label>
        <input
          required
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--navy)] placeholder-[var(--muted)] transition-all focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="Nhập tên đăng nhập..."
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Mật khẩu
        </label>
        <input
          required
          type="password"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--navy)] placeholder-[var(--muted)] transition-all focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--teal)] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--teal)]/25 transition-all hover:opacity-95 hover:shadow-xl hover:shadow-[var(--teal)]/30 active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Đang xử lý..." : "Đăng nhập"}
      </button>
    </form>
  );
}
