import Link from "next/link";
import { notFound } from "next/navigation";
import { CardStudio } from "@/components/CardStudio";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewAdminCardPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();

  return (
    <div>
      <Link href="/admin/cards" className="text-sm font-medium text-[var(--teal)] hover:underline">
        ← Quay lại quản lý thẻ
      </Link>
      <header className="mb-6 mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">A2OJ Card Studio</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Tạo thẻ bài</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Thiết kế thẻ sưu tầm hoặc thẻ PvP, tạo chỉ số nhanh và xem trước nội tại trước khi lưu.
        </p>
      </header>
      <CardStudio />
    </div>
  );
}
