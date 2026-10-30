import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { CreateContestForm } from "@/components/CreateContestForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewContestPage() {
  const user = await getCurrentUser();
  if (!user || !canManageContests(user.role)) {
    return (
      <p className="text-sm">
        Chỉ giáo viên được tạo contest. <Link href="/login">Đăng nhập</Link>
      </p>
    );
  }

  const problems = await prisma.problem.findMany({
    where: { published: true, contestOnly: false },
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Tạo kỳ thi</h1>
      <CreateContestForm problems={problems} />
    </div>
  );
}
