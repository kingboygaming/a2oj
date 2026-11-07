import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { Card, CardContent } from "@/components/Card";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] max-w-md flex-col justify-center py-6">
      <Card variant="glass" className="p-2 sm:p-4">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--teal)] to-[var(--amber)] shadow-lg shadow-[var(--teal)]/20 mb-4">
              <span className="text-2xl font-black text-white">A2</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--navy)]">
              Đăng ký tài khoản
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Gia nhập đấu trường lập trình A2OJ dành cho khối chuyên Tin.
            </p>
          </div>

          <RegisterForm />

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-semibold text-[var(--teal)] hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
