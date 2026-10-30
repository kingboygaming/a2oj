import Link from "next/link";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Xác minh email</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Xác nhận email này để liên kết với tài khoản A2OJ. Liên kết chỉ dùng được một lần.
      </p>
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          Liên kết không có mã xác minh. Hãy yêu cầu gửi lại trong{" "}
          <Link href="/settings/email" className="underline">cài đặt email</Link>.
        </p>
      )}
    </div>
  );
}
