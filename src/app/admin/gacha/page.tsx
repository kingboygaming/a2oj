import Link from "next/link";
import { notFound } from "next/navigation";
import { GachaAdminPanel } from "@/components/GachaAdminPanel";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminGachaPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") notFound();
  const [banners, specialCards, cards] = await Promise.all([
    prisma.gachaBanner.findMany({
      orderBy: { createdAt: "desc" },
      include: { cards: { include: { card: { select: { name: true, rarity: true } } } } },
    }),
    prisma.gachaCard.findMany({
      where: { specialOnly: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, rarity: true },
    }),
    prisma.gachaCard.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, rarity: true, specialOnly: true },
    }),
  ]);
  return (
    <div>
      <Link href="/admin" className="text-sm font-medium text-[var(--teal)] hover:underline">← Quay lại quản trị</Link>
      <header className="mb-6 mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--teal)]">Quản trị cộng đồng</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--navy)]">Gacha và thẻ</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Tạo banner thường/giới hạn, đặt tỉ lệ thẻ và quản lý thẻ đặc biệt.</p>
      </header>
      <GachaAdminPanel banners={banners} specialCards={specialCards} cards={cards} />
    </div>
  );
}
