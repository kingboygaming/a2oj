"use client";

import { useState } from "react";

export function AccountSecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không đổi được mật khẩu.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.");
    } catch {
      setError("Không thể kết nối để đổi mật khẩu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <div>
        <h2 className="font-semibold text-[var(--navy)]">Mật khẩu</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Đổi mật khẩu để bảo vệ tài khoản. Các phiên đăng nhập khác sẽ bị đăng xuất.
        </p>
      </div>
      <form onSubmit={changePassword} className="max-w-xl space-y-3">
        <label className="block text-sm">
          Mật khẩu hiện tại
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Mật khẩu mới
            <input
              required
              minLength={8}
              maxLength={72}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Nhập lại mật khẩu mới
            <input
              required
              minLength={8}
              maxLength={72}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Đang đổi..." : "Đổi mật khẩu"}
        </button>
        {status && <p role="status" className="text-sm text-emerald-700">{status}</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    </section>
  );
}
