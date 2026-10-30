import { ContributeForm } from "@/components/ContributeForm";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="text-sm">
        Cần <Link href="/login" className="text-[var(--teal)] underline">đăng nhập</Link> để đóng góp đề.
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Tạo / đóng góp bài tập</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Viết đề Markdown (có KaTeX). Giáo viên được đăng luôn; học sinh chờ duyệt.
      </p>
      <ContributeForm />
    </div>
  );
}
