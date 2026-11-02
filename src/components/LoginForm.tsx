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
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <label className="block text-sm">
        Tài khoản
        <input
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label className="block text-sm">
        Mật khẩu
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--surface-strong)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang vào..." : "Vào lớp"}
      </button>
    </form>
  );
}
