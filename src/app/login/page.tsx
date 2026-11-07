import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";
import { Card, CardContent } from "@/components/Card";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] max-w-md flex-col justify-center py-6">
      <Card variant="glass" className="p-2 sm:p-4">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--teal)] to-[var(--amber)] shadow-lg shadow-[var(--teal)]/20 mb-4">
              <span className="text-2xl font-black text-white">A2</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)]">
              Đăng nhập A2OJ
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Chào mừng quay trở lại! Đăng nhập để nộp bài và thi đấu.
            </p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-[var(--teal)] hover:underline">
              Đăng ký tài khoản học sinh
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
