import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Tạo tài khoản học sinh</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Tài khoản mới mặc định là học sinh. Liên hệ giáo viên nếu cần quyền khác.
      </p>
      <RegisterForm />
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-[var(--teal)] hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
