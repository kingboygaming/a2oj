import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Đăng nhập</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Đăng nhập để nộp bài và tham gia contest.</p>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-medium text-[var(--teal)] hover:underline">
          Đăng ký học sinh
        </Link>
      </p>
    </div>
  );
}
