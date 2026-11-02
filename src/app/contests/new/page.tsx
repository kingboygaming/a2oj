import { prisma } from "@/lib/prisma";
import { canManageContests, getCurrentUser } from "@/lib/auth";
import { ContestForm } from "@/components/ContestForm";
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

  const [problems, specialCards] = await Promise.all([prisma.problem.findMany({
    where: { published: true, contestOnly: false },
    orderBy: { title: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      judgeType: true,
      ioMode: true,
      inputFile: true,
      outputFile: true,
    },
  }), prisma.gachaCard.findMany({
    where: { specialOnly: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rarity: true },
  })]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Tạo kỳ thi mới</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Thiết lập thời gian, bài tập, cấu hình số test chấm và thêm các bài thi độc lập.
      </p>
      <ContestForm availableProblems={problems} specialCards={specialCards} />
    </div>
  );
}
