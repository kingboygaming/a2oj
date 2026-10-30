"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  email: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
};

export function EmailSettings({ email, emailVerified, pendingEmail }: Props) {
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState(email ?? pendingEmail ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestEmailVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress, currentPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Không gửi được email xác minh.");
        return;
      }

      setCurrentPassword("");
      setStatus(data.message);
      router.refresh();
    } catch {
      setError("Không thể kết nối để liên kết email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5">
      <div>
        <h2 className="font-semibold text-[var(--navy)]">Email liên kết</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Email chỉ được liên kết sau khi xác minh qua đường dẫn gửi đến hộp thư.
        </p>
      </div>
      {email && (
        <p className="text-sm text-[var(--muted)]">
          Email hiện tại: <span className="font-medium text-[var(--navy)]">{email}</span>
          {emailVerified && <span className="ml-2 text-emerald-700">Đã xác minh</span>}
        </p>
      )}
      {pendingEmail && (
        <p className="text-sm text-amber-800">
          Đang chờ xác minh <span className="font-medium">{pendingEmail}</span>. Gửi lại để nhận liên kết mới.
        </p>
      )}
      <form onSubmit={requestEmailVerification} className="max-w-xl space-y-3">
        <label className="block text-sm">
          Email mới
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Mật khẩu hiện tại để xác nhận
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "Đang gửi..." : "Gửi liên kết xác minh"}
        </button>
        {status && <p role="status" className="text-sm text-emerald-700">{status}</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    </section>
  );
}
