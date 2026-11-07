"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không tạo được tài khoản.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Không thể kết nối để đăng ký.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 space-y-4"
    >
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Tên hiển thị (Họ và tên)
        </label>
        <input
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          placeholder="Nguyễn Văn A"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--navy)] placeholder-[var(--muted)] transition-all focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Tên đăng nhập
        </label>
        <input
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          placeholder="username"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--navy)] placeholder-[var(--muted)] transition-all focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20 font-mono"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
        <span className="mt-1 block text-[11px] text-[var(--muted)]">
          3–24 ký tự; chỉ dùng chữ thường, số và dấu gạch dưới.
        </span>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Mật khẩu
        </label>
        <input
          required
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="Tối thiểu 8 ký tự"
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--navy)] placeholder-[var(--muted)] transition-all focus:border-[var(--teal)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/20"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && (
        <div role="alert" className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--teal)] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--teal)]/25 transition-all hover:opacity-95 hover:shadow-xl hover:shadow-[var(--teal)]/30 active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Đang tạo tài khoản..." : "Hoàn tất đăng ký"}
      </button>
    </form>
  );
}
