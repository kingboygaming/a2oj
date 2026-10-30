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
      className="mt-6 space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5"
    >
      <label className="block text-sm">
        Tên hiển thị
        <input
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Tên đăng nhập
        <input
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          3–24 ký tự; chỉ dùng chữ, số và dấu gạch dưới.
        </span>
      </label>
      <label className="block text-sm">
        Mật khẩu
        <input
          required
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          Tối thiểu 8 ký tự.
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[var(--surface-strong)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>
    </form>
  );
}
